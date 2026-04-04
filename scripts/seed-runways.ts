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
