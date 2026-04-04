# All-Runway Approach Cones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only page showing all 12 EHAM approach cones on a Leaflet map, with runway data served from a Neon Postgres `runways` table seeded from the OurAirports CSV.

**Architecture:** Runway CSV → seed script → Neon DB → Next.js API route → TanStack Query hook → client-side `buildConePolygon()` → Leaflet polygons on a dev-only `/component` page.

**Tech Stack:** Drizzle ORM + Neon (Postgres), Next.js App Router, TanStack Query, Leaflet + react-leaflet, Bun scripts.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `drizzle/schema/public.ts` (modify) | Add `runways` table alongside existing `aircraft` |
| Create | `scripts/seed-runways.ts` | Parse CSV, upsert all rows into `runways` table |
| Modify | `package.json` | Add `db:seed-runways` script |
| Create | `app/api/runways/route.ts` | `GET /api/runways?airport=EHAM` |
| Create | `hooks/useRunways.ts` | TanStack Query hook for runway data |
| Modify | `lib/approachCone.ts` | Export `buildConePolygon` and `ConeConfig` |
| Create | `app/component/page.tsx` | Dev-only page shell (server component with guard) |
| Create | `components/runway-lab/RunwayLabMap.tsx` | Dynamic import wrapper (no SSR) |
| Create | `components/runway-lab/RunwayLabMapInner.tsx` | Leaflet map with all cones |

---

### Task 1: Add `runways` table to Drizzle schema

**Files:**
- Modify: `drizzle/schema/public.ts`

- [ ] **Step 1: Add the runways table definition**

Add to `drizzle/schema/public.ts`, after the existing `aircraft` table:

```typescript
import { pgTable, text, timestamp, integer, real, boolean, index } from 'drizzle-orm/pg-core';

export const runways = pgTable('runways', {
  id: integer('id').primaryKey(),
  airportRef: integer('airport_ref'),
  airportIdent: text('airport_ident'),
  lengthFt: integer('length_ft'),
  widthFt: integer('width_ft'),
  surface: text('surface'),
  lighted: boolean('lighted'),
  closed: boolean('closed'),
  leIdent: text('le_ident'),
  leLatitudeDeg: real('le_latitude_deg'),
  leLongitudeDeg: real('le_longitude_deg'),
  leElevationFt: real('le_elevation_ft'),
  leHeadingDegT: real('le_heading_deg_t'),
  leDisplacedThresholdFt: real('le_displaced_threshold_ft'),
  heIdent: text('he_ident'),
  heLatitudeDeg: real('he_latitude_deg'),
  heLongitudeDeg: real('he_longitude_deg'),
  heElevationFt: real('he_elevation_ft'),
  heHeadingDegT: real('he_heading_deg_t'),
  heDisplacedThresholdFt: real('he_displaced_threshold_ft'),
}, (table) => [
  index('runways_airport_ident_idx').on(table.airportIdent),
]);
```

Note: update the existing import from `drizzle-orm/pg-core` to include `integer`, `real`, `boolean`, and `index`.

- [ ] **Step 2: Generate the migration**

Run: `bunx drizzle-kit generate`

Expected: a new SQL migration file in `drizzle/migrations/` that creates the `runways` table with the index.

- [ ] **Step 3: Apply the migration**

Run: `bunx drizzle-kit migrate`

Expected: migration applies successfully, `runways` table created in the database.

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add drizzle/schema/public.ts drizzle/migrations/
git commit -m "feat: add runways table to public schema"
```

---

### Task 2: Create seed script

**Files:**
- Create: `scripts/seed-runways.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-runways.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { runways } from '../drizzle/schema/public';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const neonClient = neon(DATABASE_URL);
const db = drizzle(neonClient);

const csvPath = resolve(import.meta.dirname, '../data/ourairports/runways.csv');
const raw = readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter((l) => l.trim() !== '');
// Skip header
const dataLines = lines.slice(1);

function parseLine(line: string): string[] {
  // OurAirports CSV uses simple double-quoted fields, no embedded quotes/commas in values
  return line.split(',').map((f) => f.replace(/^"|"$/g, '').trim());
}

type RunwayInsert = typeof runways.$inferInsert;

const BATCH_SIZE = 500;
let inserted = 0;

async function seed() {
  const batch: RunwayInsert[] = [];

  for (const line of dataLines) {
    const f = parseLine(line);
    // f indices: 0=id, 1=airport_ref, 2=airport_ident, 3=length_ft, 4=width_ft,
    // 5=surface, 6=lighted, 7=closed, 8=le_ident, 9=le_lat, 10=le_lon,
    // 11=le_elev, 12=le_heading, 13=le_displaced, 14=he_ident, 15=he_lat,
    // 16=he_lon, 17=he_elev, 18=he_heading, 19=he_displaced

    const id = parseInt(f[0], 10);
    if (Number.isNaN(id)) continue;

    batch.push({
      id,
      airportRef: f[1] ? parseInt(f[1], 10) : null,
      airportIdent: f[2] || null,
      lengthFt: f[3] ? parseInt(f[3], 10) : null,
      widthFt: f[4] ? parseInt(f[4], 10) : null,
      surface: f[5] || null,
      lighted: f[6] === '1',
      closed: f[7] === '1',
      leIdent: f[8] || null,
      leLatitudeDeg: f[9] ? parseFloat(f[9]) : null,
      leLongitudeDeg: f[10] ? parseFloat(f[10]) : null,
      leElevationFt: f[11] ? parseFloat(f[11]) : null,
      leHeadingDegT: f[12] ? parseFloat(f[12]) : null,
      leDisplacedThresholdFt: f[13] ? parseFloat(f[13]) : null,
      heIdent: f[14] || null,
      heLatitudeDeg: f[15] ? parseFloat(f[15]) : null,
      heLongitudeDeg: f[16] ? parseFloat(f[16]) : null,
      heElevationFt: f[17] ? parseFloat(f[17]) : null,
      heHeadingDegT: f[18] ? parseFloat(f[18]) : null,
      heDisplacedThresholdFt: f[19] ? parseFloat(f[19]) : null,
    });

    if (batch.length >= BATCH_SIZE) {
      await db.insert(runways).values(batch).onConflictDoUpdate({
        target: runways.id,
        set: {
          airportRef: sql`excluded.airport_ref`,
          airportIdent: sql`excluded.airport_ident`,
          lengthFt: sql`excluded.length_ft`,
          widthFt: sql`excluded.width_ft`,
          surface: sql`excluded.surface`,
          lighted: sql`excluded.lighted`,
          closed: sql`excluded.closed`,
          leIdent: sql`excluded.le_ident`,
          leLatitudeDeg: sql`excluded.le_latitude_deg`,
          leLongitudeDeg: sql`excluded.le_longitude_deg`,
          leElevationFt: sql`excluded.le_elevation_ft`,
          leHeadingDegT: sql`excluded.le_heading_deg_t`,
          leDisplacedThresholdFt: sql`excluded.le_displaced_threshold_ft`,
          heIdent: sql`excluded.he_ident`,
          heLatitudeDeg: sql`excluded.he_latitude_deg`,
          heLongitudeDeg: sql`excluded.he_longitude_deg`,
          heElevationFt: sql`excluded.he_elevation_ft`,
          heHeadingDegT: sql`excluded.he_heading_deg_t`,
          heDisplacedThresholdFt: sql`excluded.he_displaced_threshold_ft`,
        },
      });
      inserted += batch.length;
      console.log(`Upserted ${inserted} rows...`);
      batch.length = 0;
    }
  }

  // Flush remaining
  if (batch.length > 0) {
    await db.insert(runways).values(batch).onConflictDoUpdate({
      target: runways.id,
      set: {
        airportRef: sql`excluded.airport_ref`,
        airportIdent: sql`excluded.airport_ident`,
        lengthFt: sql`excluded.length_ft`,
        widthFt: sql`excluded.width_ft`,
        surface: sql`excluded.surface`,
        lighted: sql`excluded.lighted`,
        closed: sql`excluded.closed`,
        leIdent: sql`excluded.le_ident`,
        leLatitudeDeg: sql`excluded.le_latitude_deg`,
        leLongitudeDeg: sql`excluded.le_longitude_deg`,
        leElevationFt: sql`excluded.le_elevation_ft`,
        leHeadingDegT: sql`excluded.le_heading_deg_t`,
        leDisplacedThresholdFt: sql`excluded.le_displaced_threshold_ft`,
        heIdent: sql`excluded.he_ident`,
        heLatitudeDeg: sql`excluded.he_latitude_deg`,
        heLongitudeDeg: sql`excluded.he_longitude_deg`,
        heElevationFt: sql`excluded.he_elevation_ft`,
        heHeadingDegT: sql`excluded.he_heading_deg_t`,
        heDisplacedThresholdFt: sql`excluded.he_displaced_threshold_ft`,
      },
    });
    inserted += batch.length;
  }

  console.log(`Done. Total rows upserted: ${inserted}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the package.json script**

Add to `package.json` `scripts`:

```json
"db:seed-runways": "bun run scripts/seed-runways.ts"
```

- [ ] **Step 3: Run the seed**

Run: `bun run db:seed-runways`

Expected: logs showing batches of 500, ending with `Done. Total rows upserted: ~47731`.

- [ ] **Step 4: Verify data**

Run: `bunx drizzle-kit studio`

Open the studio, check that the `runways` table has data and that filtering by `airport_ident = 'EHAM'` returns 6 rows.

- [ ] **Step 5: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-runways.ts package.json
git commit -m "feat: add runway seed script from OurAirports CSV"
```

---

### Task 3: Create API route

**Files:**
- Create: `app/api/runways/route.ts`

- [ ] **Step 1: Write the route handler**

Create `app/api/runways/route.ts`:

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { runways } from '@/drizzle/schema/public';

export async function GET(request: NextRequest) {
  const airport = request.nextUrl.searchParams.get('airport');
  if (!airport) {
    return NextResponse.json({ error: 'airport query param required' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(runways)
    .where(eq(runways.airportIdent, airport.toUpperCase()));

  return NextResponse.json(rows);
}
```

- [ ] **Step 2: Test manually**

Start dev server: `bun run dev`

Run: `curl 'http://localhost:3000/api/runways?airport=EHAM'`

Expected: JSON array with 6 runway objects. Verify one has `leIdent: "09"`, `heIdent: "27"`.

Run: `curl 'http://localhost:3000/api/runways'`

Expected: 400 with `{ "error": "airport query param required" }`.

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/runways/route.ts
git commit -m "feat: add GET /api/runways endpoint"
```

---

### Task 4: Create `useRunways` hook

**Files:**
- Create: `hooks/useRunways.ts`

- [ ] **Step 1: Write the hook**

Create `hooks/useRunways.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

export interface Runway {
  id: number;
  airportRef: number | null;
  airportIdent: string | null;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null;
  lighted: boolean | null;
  closed: boolean | null;
  leIdent: string | null;
  leLatitudeDeg: number | null;
  leLongitudeDeg: number | null;
  leElevationFt: number | null;
  leHeadingDegT: number | null;
  leDisplacedThresholdFt: number | null;
  heIdent: string | null;
  heLatitudeDeg: number | null;
  heLongitudeDeg: number | null;
  heElevationFt: number | null;
  heHeadingDegT: number | null;
  heDisplacedThresholdFt: number | null;
}

export function useRunways(airportIdent: string) {
  return useQuery<Runway[]>({
    queryKey: ['runways', airportIdent],
    queryFn: async () => {
      const res = await fetch(`/api/runways?airport=${encodeURIComponent(airportIdent)}`);
      if (!res.ok) throw new Error('Failed to fetch runways');
      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useRunways.ts
git commit -m "feat: add useRunways TanStack Query hook"
```

---

### Task 5: Export `buildConePolygon` from `lib/approachCone.ts`

**Files:**
- Modify: `lib/approachCone.ts`

- [ ] **Step 1: Export the function and interface**

In `lib/approachCone.ts`, make two changes:

1. Add `export` to the `ConeConfig` interface (line 45):

```typescript
export interface ConeConfig {
```

2. Add `export` to the `buildConePolygon` function (line 74):

```typescript
export function buildConePolygon(cfg: ConeConfig): [number, number][] {
```

No other changes needed.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/approachCone.ts
git commit -m "feat: export buildConePolygon and ConeConfig from approachCone"
```

---

### Task 6: Create the dev page and map components

**Files:**
- Create: `app/component/page.tsx`
- Create: `components/runway-lab/RunwayLabMap.tsx`
- Create: `components/runway-lab/RunwayLabMapInner.tsx`

- [ ] **Step 1: Create the page shell**

Create `app/component/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { RunwayLabMap } from '@/components/runway-lab/RunwayLabMap';

export default function ComponentPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <main className="h-screen w-screen">
      <RunwayLabMap />
    </main>
  );
}
```

- [ ] **Step 2: Create the dynamic import wrapper**

Create `components/runway-lab/RunwayLabMap.tsx`:

```typescript
'use client';

import dynamic from 'next/dynamic';

const RunwayLabMapInner = dynamic(() => import('./RunwayLabMapInner'), { ssr: false });

export function RunwayLabMap() {
  return (
    <div className="h-full w-full">
      <RunwayLabMapInner />
    </div>
  );
}
```

- [ ] **Step 3: Create the inner map component**

Create `components/runway-lab/RunwayLabMapInner.tsx`:

```typescript
'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useRunways, type Runway } from '@/hooks/useRunways';
import { buildConePolygon, type ConeConfig } from '@/lib/approachCone';
import {
  SCHIPHOL_LAT,
  SCHIPHOL_LON,
  TILE_LIGHT,
  TILE_DARK,
  TILE_ATTRIBUTION,
  COLOR_CONE,
  FT_TO_M,
  M_PER_DEG_LAT,
  RUNWAY_WIDTH_SCALE,
} from '@/components/flight-map/mapConstants';

// ---------------------------------------------------------------------------
// Dark mode (same pattern as FlightMapInner)
// ---------------------------------------------------------------------------

function subscribeToDarkMode(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getIsDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getIsDarkServer(): boolean {
  return true;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeToDarkMode, getIsDark, getIsDarkServer);
}

// ---------------------------------------------------------------------------
// Cone parameters (match existing Buitenveldertbaan cones)
// ---------------------------------------------------------------------------

const CONE_HALF_ANGLE_DEG = 6;
const CONE_LENGTH_M = 28_000;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function runwayPolygon(le: [number, number], he: [number, number], widthFt: number): [number, number][] {
  const halfWidthM = (widthFt * FT_TO_M) / 2;
  const dLat = he[0] - le[0];
  const dLon = he[1] - le[1];
  const midLat = (le[0] + he[0]) / 2;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  const dLatM = dLat * M_PER_DEG_LAT;
  const dLonM = dLon * mPerDegLon;
  const length = Math.sqrt(dLatM * dLatM + dLonM * dLonM);
  const perpLatM = dLonM / length;
  const perpLonM = -dLatM / length;
  const offsetLat = (perpLatM * halfWidthM) / M_PER_DEG_LAT;
  const offsetLon = (perpLonM * halfWidthM) / mPerDegLon;
  return [
    [le[0] + offsetLat, le[1] + offsetLon],
    [le[0] - offsetLat, le[1] - offsetLon],
    [he[0] - offsetLat, he[1] - offsetLon],
    [he[0] + offsetLat, he[1] + offsetLon],
  ];
}

interface ConeData {
  key: string;
  polygon: [number, number][];
}

function buildConesFromRunways(runways: Runway[]): ConeData[] {
  const cones: ConeData[] = [];

  for (const rwy of runways) {
    // LE approach cone: planes land heading le_heading, so they approach from the reciprocal
    if (rwy.leLatitudeDeg != null && rwy.leLongitudeDeg != null && rwy.leHeadingDegT != null) {
      const approachBearing = (rwy.leHeadingDegT + 180) % 360;
      cones.push({
        key: `${rwy.id}-le-${rwy.leIdent}`,
        polygon: buildConePolygon({
          threshold: [rwy.leLatitudeDeg, rwy.leLongitudeDeg],
          approachBearing,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }

    // HE approach cone
    if (rwy.heLatitudeDeg != null && rwy.heLongitudeDeg != null && rwy.heHeadingDegT != null) {
      const approachBearing = (rwy.heHeadingDegT + 180) % 360;
      cones.push({
        key: `${rwy.id}-he-${rwy.heIdent}`,
        polygon: buildConePolygon({
          threshold: [rwy.heLatitudeDeg, rwy.heLongitudeDeg],
          approachBearing,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }
  }

  return cones;
}

interface RunwayStripData {
  key: string;
  corners: [number, number][];
  leIdent: string;
  heIdent: string;
  le: [number, number];
  he: [number, number];
}

function buildRunwayStrips(runways: Runway[]): RunwayStripData[] {
  const strips: RunwayStripData[] = [];

  for (const rwy of runways) {
    if (
      rwy.leLatitudeDeg == null || rwy.leLongitudeDeg == null ||
      rwy.heLatitudeDeg == null || rwy.heLongitudeDeg == null ||
      rwy.widthFt == null
    ) continue;

    const le: [number, number] = [rwy.leLatitudeDeg, rwy.leLongitudeDeg];
    const he: [number, number] = [rwy.heLatitudeDeg, rwy.heLongitudeDeg];

    strips.push({
      key: `strip-${rwy.id}`,
      corners: runwayPolygon(le, he, rwy.widthFt * RUNWAY_WIDTH_SCALE),
      leIdent: rwy.leIdent ?? '',
      heIdent: rwy.heIdent ?? '',
      le,
      he,
    });
  }

  return strips;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RunwayLabMapInner() {
  const isDark = useIsDarkMode();
  const { data: runways = [], isLoading } = useRunways('EHAM');

  const cones = useMemo(() => buildConesFromRunways(runways), [runways]);
  const strips = useMemo(() => buildRunwayStrips(runways), [runways]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">
        Loading runway data…
      </div>
    );
  }

  return (
    <MapContainer
      center={[SCHIPHOL_LAT, SCHIPHOL_LON]}
      zoom={11}
      minZoom={9}
      maxZoom={16}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        key={isDark ? 'dark' : 'light'}
        attribution={TILE_ATTRIBUTION}
        url={isDark ? TILE_DARK : TILE_LIGHT}
      />

      {/* Approach cones — muted green */}
      {cones.map((cone) => (
        <Polygon
          key={cone.key}
          positions={cone.polygon}
          pathOptions={{
            color: COLOR_CONE,
            fillColor: COLOR_CONE,
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '6 3',
          }}
        />
      ))}

      {/* Runway strips */}
      {strips.map((strip) => (
        <Polygon
          key={strip.key}
          positions={strip.corners}
          pathOptions={{
            color: isDark ? '#a1a1aa' : '#555',
            fillColor: isDark ? '#71717a' : '#333',
            fillOpacity: 0.7,
            weight: 1,
          }}
        />
      ))}

      {/* Runway labels */}
      {strips.map((strip) => (
        <React.Fragment key={`lbl-${strip.key}`}>
          <Marker position={strip.le} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
            <Tooltip permanent direction="center" className="runway-label">
              {strip.leIdent}
            </Tooltip>
          </Marker>
          <Marker position={strip.he} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
            <Tooltip permanent direction="center" className="runway-label">
              {strip.heIdent}
            </Tooltip>
          </Marker>
        </React.Fragment>
      ))}
    </MapContainer>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`

Expected: no errors.

- [ ] **Step 5: Test in browser**

Run: `bun run dev`

Open: `http://localhost:3000/component`

Expected:
- Leaflet map centered on Schiphol
- 6 runway strips with labels (04/22, 06/24, 09/27, 18C/36C, 18L/36R, 18R/36L)
- 12 muted green approach cones (one per runway end), extending ~15 NM from each threshold
- No flight markers, no HUD, no controls

- [ ] **Step 6: Commit**

```bash
git add app/component/page.tsx components/runway-lab/RunwayLabMap.tsx components/runway-lab/RunwayLabMapInner.tsx
git commit -m "feat: add dev-only /component page with all-runway approach cones"
```
