# Drizzle + Neon Data Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist all raw ingested flight, weather, and arrival data into a Neon PostgreSQL database using Drizzle ORM, via standalone cron functions triggered by Next.js API routes.

**Architecture:** Standalone cron functions in `cron/` fetch data from external APIs and insert raw rows into Neon. Each cron function is exported and called by a thin API route handler in `app/api/cron/`. The existing in-memory pipeline is untouched. Two Postgres schemas: `ingest` (append-only time-series) and `public` (reference data).

**Tech Stack:** Drizzle ORM, `@neondatabase/serverless`, `drizzle-kit`, Neon PostgreSQL 17, Bun

**Spec:** `docs/superpowers/specs/2026-04-01-drizzle-neon-ingestion-design.md`

---

### Task 1: Install dependencies and add db scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Drizzle ORM, Neon driver, and Drizzle Kit**

```bash
bun add drizzle-orm @neondatabase/serverless
bun add -d drizzle-kit
```

- [ ] **Step 2: Add database scripts to package.json**

Add these to the `"scripts"` section in `package.json`:

```json
"db:generate": "bunx drizzle-kit generate",
"db:migrate": "bunx drizzle-kit migrate",
"db:studio": "bunx drizzle-kit studio"
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add drizzle-orm, neon serverless driver, and drizzle-kit"
```

---

### Task 2: Create Drizzle config and database client

**Files:**
- Create: `drizzle.config.ts`
- Create: `drizzle/db.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './drizzle/schema/*',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 2: Create `drizzle/db.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql);
```

- [ ] **Step 3: Commit**

```bash
git add drizzle.config.ts drizzle/db.ts
git commit -m "feat: add Drizzle config and Neon database client"
```

---

### Task 3: Define ingest schema

**Files:**
- Create: `drizzle/schema/ingest.ts`

The `ingest` schema contains three append-only tables for raw time-series data. All values are stored in their original units from the source APIs.

- [ ] **Step 1: Create `drizzle/schema/ingest.ts`**

```ts
import {
  pgSchema,
  bigserial,
  text,
  doublePrecision,
  boolean,
  smallint,
  timestamp,
  integer,
  uuid,
  jsonb,
  real,
  index,
} from 'drizzle-orm/pg-core';

export const ingestSchema = pgSchema('ingest');

// ---------------------------------------------------------------------------
// OpenSky state vectors — one row per aircraft per poll cycle
// All 17 fields stored in original units (meters, m/s)
// ---------------------------------------------------------------------------

export const openskyStateVectors = ingestSchema.table(
  'opensky_state_vectors',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    pollId: uuid('poll_id').notNull(),
    polledAt: timestamp('polled_at', { withTimezone: true }).notNull().defaultNow(),
    responseTime: integer('response_time').notNull(),
    icao24: text('icao24').notNull(),
    callsign: text('callsign'),
    originCountry: text('origin_country'),
    timePosition: integer('time_position'),
    lastContact: integer('last_contact'),
    longitude: doublePrecision('longitude'),
    latitude: doublePrecision('latitude'),
    baroAltitude: doublePrecision('baro_altitude'),
    onGround: boolean('on_ground'),
    velocity: doublePrecision('velocity'),
    trueTrack: doublePrecision('true_track'),
    verticalRate: doublePrecision('vertical_rate'),
    sensors: jsonb('sensors'),
    geoAltitude: doublePrecision('geo_altitude'),
    squawk: text('squawk'),
    spi: boolean('spi'),
    positionSource: smallint('position_source'),
  },
  (table) => [
    index('idx_osv_polled_at').on(table.polledAt),
    index('idx_osv_icao24').on(table.icao24),
    index('idx_osv_icao24_polled_at').on(table.icao24, table.polledAt),
  ],
);

// ---------------------------------------------------------------------------
// METAR weather — one row per fetch, raw + parsed in the same row
// ---------------------------------------------------------------------------

export const metar = ingestSchema.table(
  'metar',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    station: text('station').notNull(),
    raw: text('raw').notNull(),
    observationTime: timestamp('observation_time', { withTimezone: true }),
    temp: real('temp'),
    dewpoint: real('dewpoint'),
    windDirection: smallint('wind_direction'),
    windSpeed: smallint('wind_speed'),
    windGust: smallint('wind_gust'),
    visibility: real('visibility'),
    clouds: jsonb('clouds'),
    ceiling: integer('ceiling'),
    qnh: real('qnh'),
    flightCategory: text('flight_category'),
  },
  (table) => [index('idx_metar_fetched_at').on(table.fetchedAt)],
);

// ---------------------------------------------------------------------------
// Flighty arrivals — one row per arrival row per scrape
// ---------------------------------------------------------------------------

export const flightyArrivals = ingestSchema.table(
  'flighty_arrivals',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    flightId: text('flight_id').notNull(),
    flightNumber: text('flight_number').notNull(),
    airlineIata: text('airline_iata'),
    airlineName: text('airline_name'),
    city: text('city'),
    status: jsonb('status'),
    originalTime: jsonb('original_time'),
    newTime: jsonb('new_time'),
    departure: jsonb('departure'),
    arrival: jsonb('arrival'),
    secondaryCorner: text('secondary_corner'),
  },
  (table) => [
    index('idx_fa_scraped_at').on(table.scrapedAt),
    index('idx_fa_flight_number').on(table.flightNumber),
  ],
);
```

- [ ] **Step 2: Commit**

```bash
git add drizzle/schema/ingest.ts
git commit -m "feat: define ingest schema with opensky, metar, and flighty tables"
```

---

### Task 4: Define public schema

**Files:**
- Create: `drizzle/schema/public.ts`

- [ ] **Step 1: Create `drizzle/schema/public.ts`**

```ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const aircraft = pgTable('aircraft', {
  icao24: text('icao24').primaryKey(),
  icaoType: text('icao_type'),
  manufacturer: text('manufacturer'),
  registration: text('registration'),
  owner: text('owner'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Commit**

```bash
git add drizzle/schema/public.ts
git commit -m "feat: define public aircraft reference table"
```

---

### Task 5: Generate and run initial migration

**Files:**
- Generated: `drizzle/migrations/*.sql`

- [ ] **Step 1: Generate migration SQL**

```bash
bun run db:generate
```

Expected: Creates SQL files in `drizzle/migrations/` with `CREATE SCHEMA ingest`, `CREATE TABLE` statements for all 4 tables, and index definitions.

- [ ] **Step 2: Review the generated SQL**

Read the generated migration file and verify it contains:
- `CREATE SCHEMA "ingest"`
- `CREATE TABLE "ingest"."opensky_state_vectors"` with all 21 columns
- `CREATE TABLE "ingest"."metar"` with all 15 columns
- `CREATE TABLE "ingest"."flighty_arrivals"` with all 12 columns
- `CREATE TABLE "public"."aircraft"` with all 7 columns
- All indexes from the schema definitions

- [ ] **Step 3: Run migration against Neon**

```bash
bun run db:migrate
```

Expected: Migration applies successfully.

- [ ] **Step 4: Verify tables exist**

Use Drizzle Studio or the Neon MCP tool to confirm all tables and the `ingest` schema were created.

- [ ] **Step 5: Commit**

```bash
git add drizzle/migrations/
git commit -m "feat: initial database migration — ingest + public schemas"
```

---

### Task 6: Add raw state vector fetching to OpenSky client

**Files:**
- Modify: `lib/api/opensky.ts`
- Modify: `server/opensky/client.ts`

The cron needs the raw `OpenSkyResponse` JSON (all 17 fields per aircraft), not the parsed `Flight[]`. Extract a shared error-handling helper and add a `fetchRawStates` method.

- [ ] **Step 1: Extract `parseRawResponse` helper in `lib/api/opensky.ts`**

Add this function before `parseStateVectorsResponse`:

```ts
/**
 * Parse an OpenSky HTTP response, handling errors and rate-limit headers.
 * Returns the raw JSON body.
 */
export async function parseRawResponse(res: Response): Promise<OpenSkyResponse> {
  if (!res.ok) {
    const retryAfterSeconds =
      parseNumberHeader(res.headers.get('x-rate-limit-retry-after-seconds')) ??
      parseNumberHeader(res.headers.get('retry-after'));
    const remainingCredits = parseNumberHeader(res.headers.get('x-rate-limit-remaining'));
    throw new OpenSkyHttpError(res.status, `OpenSky HTTP ${res.status}: ${res.statusText}`, {
      retryAfterSeconds,
      remainingCredits,
    });
  }
  return res.json();
}
```

- [ ] **Step 2: Refactor `parseStateVectorsResponse` to use `parseRawResponse`**

Replace the existing `parseStateVectorsResponse` function body:

```ts
export async function parseStateVectorsResponse(res: Response): Promise<Flight[]> {
  const data = await parseRawResponse(res);
  if (!data.states) return [];

  return data.states
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => parseStateVector(s, data.time));
}
```

- [ ] **Step 3: Add `fetchRawStates` to `OpenSkyClient`**

Add import for `parseRawResponse` and `OpenSkyResponse` in `server/opensky/client.ts`:

```ts
import {
  buildStateVectorsUrl,
  parseStateVectorsResponse,
  parseRawResponse,
  // ... existing imports
  type OpenSkyResponse,
} from '@/lib/api/opensky';
```

Add this method to the `OpenSkyClient` class, after `fetchStates`:

```ts
async fetchRawStates(bounds: BoundingBox): Promise<OpenSkyResponse | null> {
  if (Date.now() < this.rateLimitUntil) {
    return null;
  }

  const url = buildStateVectorsUrl(bounds);

  try {
    const res = await this.openSkyRequest(url);
    const data = await parseRawResponse(res);
    this.rateLimitUntil = 0;
    return data;
  } catch (err) {
    if (err instanceof OpenSkyHttpError && err.status === 429) {
      const retryAfterMs = Math.max((err.retryAfterSeconds ?? 300) * 1000, 60_000);
      this.rateLimitUntil = Date.now() + retryAfterMs;
      console.warn(
        `[OpenSky] Rate limited. Backing off for ${Math.round(retryAfterMs / 1000)}s`,
      );
    } else {
      console.error('[OpenSky]', err);
    }
    return null;
  }
}
```

- [ ] **Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add lib/api/opensky.ts server/opensky/client.ts
git commit -m "feat: add fetchRawStates to OpenSkyClient for raw state vector access"
```

---

### Task 7: Create OpenSky ingestion cron

**Files:**
- Create: `cron/opensky.ts`

- [ ] **Step 1: Create `cron/opensky.ts`**

```ts
import { db } from '@/drizzle/db';
import { openskyStateVectors } from '@/drizzle/schema/ingest';
import { OpenSkyClient } from '@/server/opensky/client';
import type { BoundingBox } from '@/server/opensky/types';

const APPROACH_BOUNDS: BoundingBox = {
  lamin: 52.13,
  lomin: 4.46,
  lamax: 52.52,
  lomax: 5.24,
};

export async function ingestOpenSky(): Promise<{ inserted: number }> {
  const client = new OpenSkyClient(
    process.env.OPENSKY_CLIENT_ID ?? null,
    process.env.OPENSKY_CLIENT_SECRET ?? null,
  );

  const data = await client.fetchRawStates(APPROACH_BOUNDS);
  if (!data || !data.states || data.states.length === 0) {
    return { inserted: 0 };
  }

  const pollId = crypto.randomUUID();
  const polledAt = new Date();

  const rows = data.states.map((s) => ({
    pollId,
    polledAt,
    responseTime: data.time,
    icao24: (s[0] as string).trim(),
    callsign: s[1] != null ? (s[1] as string).trim() : null,
    originCountry: (s[2] as string) ?? null,
    timePosition: (s[3] as number) ?? null,
    lastContact: (s[4] as number) ?? null,
    longitude: (s[5] as number) ?? null,
    latitude: (s[6] as number) ?? null,
    baroAltitude: (s[7] as number) ?? null,
    onGround: (s[8] as boolean) ?? null,
    velocity: (s[9] as number) ?? null,
    trueTrack: (s[10] as number) ?? null,
    verticalRate: (s[11] as number) ?? null,
    sensors: s[12] ?? null,
    geoAltitude: (s[13] as number) ?? null,
    squawk: s[14] != null ? String(s[14]) : null,
    spi: (s[15] as boolean) ?? null,
    positionSource: (s[16] as number) ?? null,
  }));

  await db.insert(openskyStateVectors).values(rows);

  return { inserted: rows.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add cron/opensky.ts
git commit -m "feat: add OpenSky state vector ingestion cron"
```

---

### Task 8: Create METAR ingestion cron

**Files:**
- Create: `cron/metar.ts`

- [ ] **Step 1: Create `cron/metar.ts`**

```ts
import { db } from '@/drizzle/db';
import { metar } from '@/drizzle/schema/ingest';
import { fetchMetar } from '@/lib/api/weather';

export async function ingestMetar(): Promise<{ station: string; raw: string }> {
  const data = await fetchMetar('EHAM');

  await db.insert(metar).values({
    fetchedAt: new Date(),
    station: data.station,
    raw: data.raw,
    observationTime: new Date(data.observationTime),
    temp: data.temp,
    dewpoint: data.dewpoint,
    windDirection: data.windDirection,
    windSpeed: data.windSpeed,
    windGust: data.windGust,
    visibility: data.visibility,
    clouds: data.clouds,
    ceiling: data.ceiling,
    qnh: data.qnh,
    flightCategory: data.flightCategory,
  });

  return { station: data.station, raw: data.raw };
}
```

- [ ] **Step 2: Commit**

```bash
git add cron/metar.ts
git commit -m "feat: add METAR ingestion cron"
```

---

### Task 9: Create Flighty arrivals ingestion cron

**Files:**
- Create: `cron/flighty.ts`

This cron fetches directly from Flighty (bypassing the in-memory cache) and inserts all arrival rows.

- [ ] **Step 1: Create `cron/flighty.ts`**

```ts
import { db } from '@/drizzle/db';
import { flightyArrivals } from '@/drizzle/schema/ingest';
import { extractInitialFlightsFromHtml } from '@/server/arrivals/parseHtml';

const FLIGHTY_URL = 'https://flighty.com/airports/amsterdam-schiphol-ams/arrivals';

export async function ingestFlighty(): Promise<{ inserted: number }> {
  const res = await fetch(FLIGHTY_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'FlightNotifier/1.0 (+https://github.com; schedule reader)',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Flighty HTTP ${res.status}`);
  }

  const html = await res.text();
  const rows = extractInitialFlightsFromHtml(html);

  if (!rows || rows.length === 0) {
    return { inserted: 0 };
  }

  const scrapedAt = new Date();

  const values = rows.map((row) => ({
    scrapedAt,
    flightId: row.id,
    flightNumber: row.flightNumber,
    airlineIata: row.airline.iata,
    airlineName: row.airline.name,
    city: row.city,
    status: row.status,
    originalTime: row.originalTime,
    newTime: row.newTime,
    departure: row.departure,
    arrival: row.arrival,
    secondaryCorner: row.secondaryCorner ?? null,
  }));

  await db.insert(flightyArrivals).values(values);

  return { inserted: values.length };
}
```

- [ ] **Step 2: Commit**

```bash
git add cron/flighty.ts
git commit -m "feat: add Flighty arrivals ingestion cron"
```

---

### Task 10: Create ADSBDB aircraft metadata cron

**Files:**
- Create: `cron/adsbdb.ts`

This cron queries the database for icao24 values from recent state vectors that aren't yet in the `aircraft` table, then looks them up via ADSBDB and inserts new rows.

- [ ] **Step 1: Create `cron/adsbdb.ts`**

```ts
import { db } from '@/drizzle/db';
import { openskyStateVectors } from '@/drizzle/schema/ingest';
import { aircraft } from '@/drizzle/schema/public';
import { fetchAircraftInfo } from '@/lib/api/adsbdb';
import { sql } from 'drizzle-orm';

export async function ingestAdsbdb(): Promise<{ inserted: number }> {
  // Find distinct icao24 values from state vectors not yet in the aircraft table
  const missing = await db.execute<{ icao24: string }>(sql`
    SELECT DISTINCT sv.icao24
    FROM ingest.opensky_state_vectors sv
    LEFT JOIN public.aircraft a ON sv.icao24 = a.icao24
    WHERE a.icao24 IS NULL
  `);

  if (!missing.rows || missing.rows.length === 0) {
    return { inserted: 0 };
  }

  let inserted = 0;
  const now = new Date();

  // Process in batches of 5 to avoid overwhelming the ADSBDB API
  const icao24s = missing.rows.map((r) => r.icao24);
  for (let i = 0; i < icao24s.length; i += 5) {
    const batch = icao24s.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (icao24) => {
        const info = await fetchAircraftInfo(icao24);
        return { icao24, info };
      }),
    );

    const toInsert = results
      .filter((r) => r.info !== null)
      .map((r) => ({
        icao24: r.icao24,
        icaoType: r.info!.icaoType,
        manufacturer: r.info!.manufacturer,
        registration: r.info!.registration,
        owner: r.info!.owner,
        firstSeenAt: now,
        updatedAt: now,
      }));

    if (toInsert.length > 0) {
      await db.insert(aircraft).values(toInsert).onConflictDoNothing();
      inserted += toInsert.length;
    }
  }

  return { inserted };
}
```

- [ ] **Step 2: Commit**

```bash
git add cron/adsbdb.ts
git commit -m "feat: add ADSBDB aircraft metadata ingestion cron"
```

---

### Task 11: Create API route handlers

**Files:**
- Create: `app/api/cron/opensky/route.ts`
- Create: `app/api/cron/metar/route.ts`
- Create: `app/api/cron/flighty/route.ts`
- Create: `app/api/cron/adsbdb/route.ts`

Each route handler is a thin wrapper that calls the cron function and returns a JSON response.

- [ ] **Step 1: Create `app/api/cron/opensky/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { ingestOpenSky } from '@/cron/opensky';

export async function POST() {
  try {
    const result = await ingestOpenSky();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/OpenSky]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/cron/metar/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { ingestMetar } from '@/cron/metar';

export async function POST() {
  try {
    const result = await ingestMetar();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/Metar]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/cron/flighty/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { ingestFlighty } from '@/cron/flighty';

export async function POST() {
  try {
    const result = await ingestFlighty();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/Flighty]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/cron/adsbdb/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { ingestAdsbdb } from '@/cron/adsbdb';

export async function POST() {
  try {
    const result = await ingestAdsbdb();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/ADSBDB]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run typecheck**

```bash
bun run typecheck
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/cron/
git commit -m "feat: add API route handlers for all ingestion crons"
```

---

### Task 12: Smoke test all endpoints

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

- [ ] **Step 2: Test METAR ingestion**

```bash
curl -X POST http://localhost:3000/api/cron/metar
```

Expected: `{"station":"EHAM","raw":"METAR EHAM ..."}` with 200 status.

- [ ] **Step 3: Test OpenSky ingestion**

```bash
curl -X POST http://localhost:3000/api/cron/opensky
```

Expected: `{"inserted":N}` where N is the number of aircraft in the approach area. Could be 0 if no flights are in the bounding box.

- [ ] **Step 4: Test Flighty ingestion**

```bash
curl -X POST http://localhost:3000/api/cron/flighty
```

Expected: `{"inserted":N}` where N is the number of arrival rows from the Flighty page.

- [ ] **Step 5: Test ADSBDB ingestion**

Run this after OpenSky has inserted some state vectors:

```bash
curl -X POST http://localhost:3000/api/cron/adsbdb
```

Expected: `{"inserted":N}` where N is the number of new aircraft looked up.

- [ ] **Step 6: Verify data in database**

Use `bun run db:studio` or the Neon MCP tools to verify:
- `ingest.opensky_state_vectors` has rows with all 17 fields populated
- `ingest.metar` has rows with both `raw` and parsed fields
- `ingest.flighty_arrivals` has rows with flight numbers and airline info
- `public.aircraft` has rows with icao_type, manufacturer, registration, owner
