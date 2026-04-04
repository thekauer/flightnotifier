import { sql } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import type { HistoricalFlightPath, HistoricalTrackPoint } from '@/lib/types';
import { pathIntersectsApproachCone27 } from '@/lib/approachCone';

interface DbTrackRow {
  icao24: string;
  callsign: string | null;
  requested_time: number;
  start_time: number | null;
  end_time: number | null;
  path:
    | Array<[number, number | null, number | null, number | null, number | null, boolean]>
    | null;
}

function normalizeCallsign(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}

function toTrackPoints(
  path: Array<[number, number | null, number | null, number | null, number | null, boolean]> | null,
): HistoricalTrackPoint[] {
  return (path ?? [])
    .filter((point) => point[1] != null && point[2] != null)
    .map((point) => ({
      time: point[0],
      lat: point[1] as number,
      lon: point[2] as number,
      altitude: point[3],
      heading: point[4],
      onGround: point[5],
    }));
}

export async function getDbFlightHistory(args: {
  callsign: string;
  origin?: string;
  destination?: string;
}): Promise<HistoricalFlightPath[]> {
  const normalized = normalizeCallsign(args.callsign);
  if (!normalized) {
    return [];
  }

  const result = await db.execute(sql`
    SELECT
      icao24,
      callsign,
      requested_time,
      start_time,
      end_time,
      path
    FROM ingest.opensky_tracks
    WHERE upper(regexp_replace(coalesce(callsign, ''), '\s+', '', 'g')) = ${normalized}
    ORDER BY requested_time DESC, fetched_at DESC, id DESC
    LIMIT 5
  `);

  return (result.rows as unknown as DbTrackRow[])
    .map((row) => {
      const points = toTrackPoints(row.path);
      if (points.length === 0) {
        return null;
      }

      return {
        icao24: row.icao24,
        callsign: normalizeCallsign(row.callsign),
        firstSeen: row.start_time ?? row.requested_time,
        lastSeen: row.end_time ?? row.requested_time,
        origin: args.origin ?? null,
        destination: args.destination ?? null,
        interceptedCone: pathIntersectsApproachCone27(points),
        path: points,
      } satisfies HistoricalFlightPath;
    })
    .filter((value): value is HistoricalFlightPath => value !== null);
}
