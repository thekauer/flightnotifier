import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { db } from '@/drizzle/db';
import { openskyStateVectors, openskyTracks } from '@/drizzle/schema/ingest';
import { OpenSkyHttpError } from '@/lib/api/opensky';
import { OpenSkyClient } from '@/server/opensky/client';

const MAX_TRACK_AGE_SECONDS = 30 * 24 * 60 * 60;
const DEDUPE_WINDOW_SECONDS = 15 * 60;
const TRACK_BATCH_SIZE = 10;

type TrackCandidate = {
  icao24: string;
  requestedTime: number;
};

function getMinTrackTimestampSeconds(): number {
  return Math.floor(Date.now() / 1000) - MAX_TRACK_AGE_SECONDS;
}

export async function ingestOpenSkyTracks(): Promise<{
  selected: number;
  inserted: number;
  skipped: number;
}> {
  const client = new OpenSkyClient(
    process.env.OPENSKY_CLIENT_ID ?? null,
    process.env.OPENSKY_CLIENT_SECRET ?? null,
  );

  const recentRows = await db
    .select({
      icao24: openskyStateVectors.icao24,
      lastContact: openskyStateVectors.lastContact,
      timePosition: openskyStateVectors.timePosition,
      responseTime: openskyStateVectors.responseTime,
    })
    .from(openskyStateVectors)
    .where(gte(openskyStateVectors.polledAt, sql`now() - interval '2 hours'`))
    .orderBy(
      openskyStateVectors.icao24,
      desc(openskyStateVectors.lastContact),
      desc(openskyStateVectors.timePosition),
      desc(openskyStateVectors.responseTime),
    );

  const minTrackTimestamp = getMinTrackTimestampSeconds();
  const candidateMap = new Map<string, number>();

  for (const row of recentRows) {
    if (candidateMap.has(row.icao24)) {
      continue;
    }

    const requestedTime = row.lastContact ?? row.timePosition ?? row.responseTime;
    if (requestedTime == null || requestedTime < minTrackTimestamp) {
      continue;
    }

    candidateMap.set(row.icao24, requestedTime);
    if (candidateMap.size >= TRACK_BATCH_SIZE) {
      break;
    }
  }

  const rawCandidates = Array.from(candidateMap.entries()).map(([icao24, requestedTime]) => ({
    icao24,
    requestedTime,
  }));

  const candidates: TrackCandidate[] = [];

  for (const candidate of rawCandidates) {
    const existing = await db
      .select({ id: openskyTracks.id })
      .from(openskyTracks)
      .where(
        and(
          eq(openskyTracks.icao24, candidate.icao24),
          gte(openskyTracks.requestedTime, candidate.requestedTime - DEDUPE_WINDOW_SECONDS),
          sql`${openskyTracks.requestedTime} <= ${candidate.requestedTime + DEDUPE_WINDOW_SECONDS}`,
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return { selected: 0, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];

    try {
      const track = await client.fetchTrack(candidate.icao24, candidate.requestedTime);
      if (!track) {
        skipped += 1;
        continue;
      }

      await db.insert(openskyTracks).values({
        fetchedAt: new Date(),
        icao24: track.icao24,
        requestedTime: candidate.requestedTime,
        startTime: track.startTime,
        endTime: track.endTime,
        callsign: track.callsign,
        path: track.path,
        source: 'state_vectors',
      });

      inserted += 1;
    } catch (error) {
      skipped += 1;

      if (error instanceof OpenSkyHttpError && error.status === 404) {
        continue;
      }

      if (error instanceof OpenSkyHttpError && error.status === 429) {
        skipped += candidates.length - i - 1;
        console.warn('[Cron/OpenSkyTracks] Rate limited while fetching tracks');
        break;
      }

      console.error('[Cron/OpenSkyTracks]', {
        icao24: candidate.icao24,
        requestedTime: candidate.requestedTime,
        error,
      });
    }
  }

  return {
    selected: candidates.length,
    inserted,
    skipped,
  };
}
