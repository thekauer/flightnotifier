# Active Airports: Postgres to DynamoDB Migration

## Summary

Migrate the `active_airports` table from Postgres (Neon/Drizzle) to DynamoDB. This table tracks which airports are currently being viewed by users and which are permanently monitored. The Go cron jobs and the Next.js API both read/write this table.

## Motivation

DynamoDB is a better fit for this workload:
- Simple key-value access pattern (upsert by `airport_ident`, full scan of ≤30 rows)
- Built-in TTL handles automatic expiry of user-touched airports
- No need for a relational model — this is a flat lookup table
- Stays within DynamoDB Always Free tier (25 RCU/WCU, 25 GB)
- Prepares the infrastructure for future DynamoDB use cases (notification budget counter, user preferences)

## DynamoDB Table Design

**Table name:** `${self:service}-${sls:stage}-active-airports`

| Attribute | Type | Description |
|-----------|------|-------------|
| `airport_ident` | String (Partition Key) | ICAO code, e.g. `EHAM` |
| `iata` | String | IATA code, e.g. `AMS` (optional) |
| `name` | String | Human-readable airport name |
| `latitude` | Number | Decimal degrees |
| `longitude` | Number | Decimal degrees |
| `touched_at` | String (ISO 8601) | Last touch timestamp |
| `ttl` | Number (Unix epoch seconds) | DynamoDB TTL — absent for permanent airports, `now() + 300` for user-touched |

**Configuration:**
- Billing mode: `PAY_PER_REQUEST` (on-demand, free tier covers this easily)
- TTL attribute: `ttl`
- Region: `eu-central-1` (same as existing cron stack)

**Item types:**
- **Permanent airports (20):** No `ttl` attribute. DynamoDB never expires them.
- **User-touched airports:** `ttl` set to `Math.floor(Date.now() / 1000) + 300` (5 minutes). Refreshed on each touch. DynamoDB automatically deletes expired items.

## Changes

### 1. Serverless Framework (`serverless.aws-cron.yml`)

Add CloudFormation resource for the DynamoDB table:
- Table definition with `airport_ident` as partition key
- TTL specification on the `ttl` attribute
- `PAY_PER_REQUEST` billing
- IAM permissions for Lambda functions: `dynamodb:Scan`, `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:DeleteItem`
- Environment variable `DYNAMODB_TABLE_ACTIVE_AIRPORTS` passed to Lambda functions

### 2. Next.js API — Service Layer (`server/http/services/airportActivityService.ts`)

Replace Drizzle/Postgres calls with AWS SDK v3 DynamoDB calls:

- **`touchActiveAirport()`** → `PutItem` with all airport attributes + `ttl = now + 300s`
- **`getActiveAirports()`** → `Scan` the entire table (≤30 items), return all attributes
- **`getActiveAirportIdents()`** → same `Scan`, project to `airport_ident` only
- **`getActiveAirportTouchedAt()`** → `GetItem` by `airport_ident`, return `touched_at`

Remove Postgres-specific error handling (`42P01`, `42P03` codes).

**New dependency:** `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`

### 3. Go Cron Jobs (`cron/internal/jobs/common.go`)

- Replace `fetchActiveAirports()` — swap pgx SQL query for DynamoDB `Scan` via AWS SDK Go v2
- Remove `defaultMonitoredAirports` hardcoded list and the merge logic in `resolveMonitoredAirports()` — all airports (permanent + user-touched) are now in the DynamoDB table
- `resolveMonitoredAirports()` simplifies to: scan table → return results

**New dependency:** `github.com/aws/aws-sdk-go-v2/service/dynamodb`

### 4. Seed Script

A one-time Node.js script (`scripts/aws/seed-active-airports.ts`) that:
1. Reads the 20 permanent airports from the current Postgres `active_airports` table (identified by their far-future or frequently-refreshed `touched_at`)
2. Writes each to DynamoDB via `PutItem` with no `ttl` attribute

This script runs once during migration. After that, the 20 permanent airports live in DynamoDB permanently.

### 5. Cleanup (post-migration)

- Remove `activeAirports` table definition from `drizzle/schema/public.ts`
- Remove related migration files if desired
- Remove `defaultMonitoredAirports` from Go code

## What Does NOT Change

- **Client hook** (`hooks/useActiveAirportTouch.ts`) — still POSTs to `/api/airports/active` every 4 minutes
- **Controller** (`server/http/controllers/airportActivityController.ts`) — same request validation and response shape
- **API route** (`app/api/airports/active/route.ts`) — same endpoint
- **Other Postgres tables** (`aircraft`, `runways`, `flight_routes`) — untouched

## Free Tier Budget

| Service | Free Tier | Expected Usage | Headroom |
|---------|-----------|----------------|----------|
| DynamoDB WCU | 25/s (on-demand: 25 WCU always free) | ~1 write/4 min per user | >99% |
| DynamoDB RCU | 25/s (on-demand: 25 RCU always free) | ~1 scan/min from cron | >99% |
| DynamoDB Storage | 25 GB | <1 KB (30 items × ~200 bytes) | >99.99% |

## Rollback Plan

If issues arise, revert the service layer to Drizzle/Postgres calls. The Postgres `active_airports` table remains intact until explicitly dropped in the cleanup phase.
