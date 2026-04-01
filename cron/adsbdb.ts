import { sql } from 'drizzle-orm';

import { db } from '@/drizzle/db';
import { aircraft } from '@/drizzle/schema/public';
import { fetchAircraftInfo } from '@/lib/api/adsbdb';

export async function ingestAdsbdb(): Promise<{ inserted: number }> {
  const missing = (await db.execute(sql`
    SELECT DISTINCT sv.icao24
    FROM ingest.opensky_state_vectors sv
    LEFT JOIN public.aircraft a ON sv.icao24 = a.icao24
    WHERE a.icao24 IS NULL
  `)) as { rows: { icao24: string }[] };

  if (!missing.rows || missing.rows.length === 0) {
    return { inserted: 0 };
  }

  let inserted = 0;
  const now = new Date();
  const icao24s = missing.rows.map((row) => row.icao24);

  for (let i = 0; i < icao24s.length; i += 5) {
    const batch = icao24s.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (icao24) => ({
        icao24,
        info: await fetchAircraftInfo(icao24),
      })),
    );

    const toInsert = results
      .filter((result) => result.info !== null)
      .map((result) => ({
        icao24: result.icao24,
        icaoType: result.info!.icaoType,
        manufacturer: result.info!.manufacturer,
        registration: result.info!.registration,
        owner: result.info!.owner,
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
