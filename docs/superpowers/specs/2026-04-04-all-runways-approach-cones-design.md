# All-Runway Approach Cones — Dev Page

**Date:** 2026-04-04

## Goal

A dev-only page (`/component`) that renders a Leaflet map showing all 12 approach cones (both directions for all 6 EHAM runways) as muted green polygons. This is a visual testing ground for approach cone geometry, using runway data from the database instead of hardcoded constants.

## Architecture

### 1. Database — `runways` table (public schema)

A new Drizzle table in `drizzle/schema/public.ts` mapping directly to the OurAirports `runways.csv` columns.

**Columns:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | `integer` | Primary key (OurAirports ID) |
| `airport_ref` | `integer` | FK to airports (not enforced) |
| `airport_ident` | `text` | e.g., `EHAM` — **indexed** |
| `length_ft` | `integer` | Runway length in feet |
| `width_ft` | `integer` | Runway width in feet |
| `surface` | `text` | e.g., `ASP`, `CON` |
| `lighted` | `boolean` | |
| `closed` | `boolean` | |
| `le_ident` | `text` | Low-end designator, e.g., `09` |
| `le_latitude_deg` | `real` | |
| `le_longitude_deg` | `real` | |
| `le_elevation_ft` | `real` | |
| `le_heading_degT` | `real` | True heading |
| `le_displaced_threshold_ft` | `real` | |
| `he_ident` | `text` | High-end designator, e.g., `27` |
| `he_latitude_deg` | `real` | |
| `he_longitude_deg` | `real` | |
| `he_elevation_ft` | `real` | |
| `he_heading_degT` | `real` | True heading |
| `he_displaced_threshold_ft` | `real` | |

### 2. Seed script — `scripts/seed-runways.ts`

- Run via `bun run db:seed-runways` (new `package.json` script)
- Reads `data/ourairports/runways.csv` with simple line-by-line CSV parsing (no external library)
- Upserts all ~47K rows into `runways` using Drizzle `onConflictDoUpdate` on `id`
- Batches of 500 rows per insert
- Logs progress and final row count

### 3. API route — `GET /api/runways?airport=EHAM`

- File: `app/api/runways/route.ts`
- Requires `airport` query param; returns 400 if missing
- Queries `runways` table filtered by `airport_ident`
- Returns JSON array of runway records

### 4. Client hook — `useRunways`

- File: `hooks/useRunways.ts`
- `useRunways(airportIdent: string)` — TanStack Query hook
- Query key: `['runways', airportIdent]`
- `staleTime: Infinity` (static data)
- Returns typed `Runway[]`

### 5. Cone computation — client-side

- Export the existing `buildConePolygon()` function from `lib/approachCone.ts` (currently module-private)
- The dev page calls `buildConePolygon()` for each runway end:
  - **LE cone:** threshold = `[le_latitude_deg, le_longitude_deg]`, approach bearing = `le_heading_degT + 180` (reciprocal — planes approach FROM the opposite direction)
  - **HE cone:** threshold = `[he_latitude_deg, he_longitude_deg]`, approach bearing = `he_heading_degT + 180`
- Same parameters as existing Buitenveldertbaan cones: `halfAngleDeg: 6`, `lengthM: 28_000`
- `ConeConfig` interface is already defined in `lib/approachCone.ts`

### 6. Dev page — `/component`

- File: `app/component/page.tsx`
- **Dev-only guard:** if `process.env.NODE_ENV !== 'development'`, return `notFound()`
- Renders a client component with:
  - Leaflet map (reuse tile layers, dark mode detection from existing `FlightMapInner`)
  - Runway strip polygons (computed from DB data using existing `runwayPolygon()` geometry)
  - Runway labels at each threshold
  - **12 muted green approach cones** — same green as `COLOR_CONE` (`#16a34a`) but at lower opacity (~0.05 fill, ~1 weight, dashed)
  - No flight markers, no notification zone, no HUD, no controls bar

## Data flow

```
runways.csv → seed script → DB (runways table)
                                    ↓
                        GET /api/runways?airport=EHAM
                                    ↓
                        useRunways('EHAM') (TanStack Query)
                                    ↓
                        buildConePolygon() × 12
                                    ↓
                        Leaflet Polygon components (muted green)
```

## What this does NOT change

- The existing dashboard map continues to use `APPROACH_CONE_27` from `lib/approachCone.ts`
- The detector (`server/opensky/detector.ts`) is untouched
- The hardcoded `EHAM_RUNWAYS` in `mapConstants.ts` remains for the production map
- No changes to the production page or any existing components
