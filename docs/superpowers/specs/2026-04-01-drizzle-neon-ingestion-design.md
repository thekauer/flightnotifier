# Drizzle + Neon Data Ingestion

Persist all raw ingested data from the flight notifier's data sources into a Neon PostgreSQL database using Drizzle ORM. This is the first step in a multi-step refactor: cron jobs write to the database independently, while the existing in-memory pipeline and APIs remain untouched. In a future phase, APIs will switch to reading from the database.

## Tech stack

- **ORM:** Drizzle ORM (`drizzle-orm`)
- **Driver:** `@neondatabase/serverless` (Neon HTTP driver, no persistent connections)
- **Migrations:** `drizzle-kit` with SQL migration files checked into git
- **Database:** Neon PostgreSQL 17, project `flightnotifier` (`sparkling-moon-09223533`), region `aws-eu-central-1`
- **Connection:** `DATABASE_URL` env var (already configured in `.env`)

## Database schemas

### `ingest` schema — raw time-series data, insert-only

All tables in this schema are append-only. No updates, no deletes. Every fetch cycle produces new rows regardless of whether the data changed.

### `public` schema — reference data

Lookup tables with upsert-on-first-sight semantics.

## Tables

### `ingest.opensky_state_vectors`

One row per aircraft per poll cycle. All 17 fields from the OpenSky state vector array are stored in their original units (meters, m/s) — no conversion.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial` | PK |
| `poll_id` | `uuid` | Groups all aircraft from the same poll cycle |
| `polled_at` | `timestamptz` | When our server made the request |
| `response_time` | `integer` | OpenSky's `time` field (unix seconds) |
| `icao24` | `text` | `[0]` hex transponder address |
| `callsign` | `text` | `[1]` space-trimmed |
| `origin_country` | `text` | `[2]` |
| `time_position` | `integer` | `[3]` unix seconds |
| `last_contact` | `integer` | `[4]` unix seconds |
| `longitude` | `double precision` | `[5]` WGS-84 degrees |
| `latitude` | `double precision` | `[6]` WGS-84 degrees |
| `baro_altitude` | `double precision` | `[7]` meters |
| `on_ground` | `boolean` | `[8]` |
| `velocity` | `double precision` | `[9]` m/s |
| `true_track` | `double precision` | `[10]` degrees |
| `vertical_rate` | `double precision` | `[11]` m/s |
| `sensors` | `jsonb` | `[12]` array of receiver IDs |
| `geo_altitude` | `double precision` | `[13]` meters |
| `squawk` | `text` | `[14]` transponder code |
| `spi` | `boolean` | `[15]` special purpose indicator |
| `position_source` | `smallint` | `[16]` 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM |

**Indexes:** `polled_at`, `icao24`, composite `(icao24, polled_at)`

### `ingest.metar`

One row per fetch. Both the raw METAR string and parsed fields are stored in the same row.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial` | PK |
| `fetched_at` | `timestamptz` | When we fetched |
| `station` | `text` | ICAO station code (EHAM) |
| `raw` | `text` | Raw METAR string |
| `observation_time` | `timestamptz` | When observation was made |
| `temp` | `real` | Celsius |
| `dewpoint` | `real` | Celsius |
| `wind_direction` | `smallint` | Degrees |
| `wind_speed` | `smallint` | Knots |
| `wind_gust` | `smallint` | Knots |
| `visibility` | `real` | Statute miles |
| `clouds` | `jsonb` | Array of `{cover, base}` |
| `ceiling` | `integer` | Feet AGL |
| `qnh` | `real` | hPa |
| `flight_category` | `text` | VFR / MVFR / IFR / LIFR |

**Index:** `fetched_at`

### `ingest.flighty_arrivals`

One row per arrival row per scrape. Every row from every scrape is stored, even if unchanged.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `bigserial` | PK |
| `scraped_at` | `timestamptz` | When we scraped |
| `flight_id` | `text` | Flighty's row `id` |
| `flight_number` | `text` | e.g. "KL1234" |
| `airline_iata` | `text` | e.g. "KL" |
| `airline_name` | `text` | e.g. "KLM" |
| `city` | `text` | Origin city |
| `status` | `jsonb` | Raw status array |
| `original_time` | `jsonb` | `{text, style}` |
| `new_time` | `jsonb` | `{text, style}` |
| `departure` | `jsonb` | `{iata, terminal, gate, flag}` |
| `arrival` | `jsonb` | `{iata, terminal, gate, belt, flag}` |
| `secondary_corner` | `text` | Optional |

**Indexes:** `scraped_at`, `flight_number`

### `public.aircraft`

One row per unique icao24. Inserted on first sight — when the ADSBDB cron encounters an icao24 not yet in this table.

| Column | Type | Notes |
|--------|------|-------|
| `icao24` | `text` | PK |
| `icao_type` | `text` | e.g. "B788" |
| `manufacturer` | `text` | e.g. "Boeing" |
| `registration` | `text` | e.g. "PH-BHA" |
| `owner` | `text` | Registered owner |
| `first_seen_at` | `timestamptz` | When we first encountered this aircraft |
| `updated_at` | `timestamptz` | Last ADSBDB lookup time |

## File structure

```
drizzle/
├── schema/
│   ├── ingest.ts          # ingest schema + 3 tables
│   └── public.ts          # aircraft table
├── migrations/            # Generated SQL migration files (checked into git)
├── migrate.ts             # Migration runner script
└── db.ts                  # Drizzle client instance (uses @neondatabase/serverless)
drizzle.config.ts          # Drizzle Kit config (schema paths + DATABASE_URL)

cron/
├── opensky.ts             # export async function ingestOpenSky()
├── metar.ts               # export async function ingestMetar()
├── flighty.ts             # export async function ingestFlighty()
└── adsbdb.ts              # export async function ingestAdsbdb()

app/api/cron/
├── opensky/route.ts       # POST → ingestOpenSky()
├── metar/route.ts         # POST → ingestMetar()
├── flighty/route.ts       # POST → ingestFlighty()
└── adsbdb/route.ts        # POST → ingestAdsbdb()
```

## Cron job design

Each cron job is a standalone function exported from `cron/`. The function handles its own fetching and database writes. The API route handlers in `app/api/cron/` are thin wrappers (~5 lines) that call the function and return a status.

### `ingestOpenSky()`

1. Fetch state vectors from OpenSky API for the Amsterdam approach bounding box
2. Generate a `poll_id` (UUID) for this cycle
3. Batch-insert all state vectors into `ingest.opensky_state_vectors`
4. Return count of inserted rows

Reuses the OpenSky HTTP client and auth from `server/opensky/client.ts` and the bounding box / URL builder from `lib/api/opensky.ts`. Fetches the raw `OpenSkyResponse` JSON directly (does not call `parseStateVector`) so all 17 fields per aircraft are available for insertion.

### `ingestMetar()`

1. Fetch METAR for EHAM from Aviation Weather API
2. Insert one row into `ingest.metar` with raw string + all parsed fields
3. Return the inserted row

Reuses the existing `fetchMetar()` from `lib/api/weather.ts`.

### `ingestFlighty()`

1. Fetch and parse the Flighty AMS arrivals HTML
2. Insert all arrival rows into `ingest.flighty_arrivals`
3. Return count of inserted rows

Reuses the existing fetch/parse from `server/arrivals/`.

### `ingestAdsbdb()`

1. Query `ingest.opensky_state_vectors` for distinct icao24 values not yet in `public.aircraft`
2. Look up each via ADSBDB API
3. Insert new rows into `public.aircraft`
4. Return count of new aircraft inserted

Reuses the existing ADSBDB client from `lib/api/adsbdb.ts`.

## Package scripts

```json
{
  "db:generate": "bunx drizzle-kit generate",
  "db:migrate": "bunx drizzle-kit migrate",
  "db:studio": "bunx drizzle-kit studio"
}
```

## What this plan does NOT change

- The existing in-memory pipeline (poller, state manager, SSE, predictions) remains untouched
- The existing API routes (`/api/state`, `/api/schedule`, `/api/events`, etc.) continue reading from memory
- No UI changes
- No prediction persistence
