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

type RawStateVector = NonNullable<NonNullable<Awaited<ReturnType<OpenSkyClient['fetchRawStates']>>>['states']>[number];

function toNumber(value: string | number | boolean | number[] | null): number | null {
  return typeof value === 'number' ? value : null;
}

function toString(value: string | number | boolean | number[] | null): string | null {
  return typeof value === 'string' ? value : null;
}

function toBoolean(value: string | number | boolean | number[] | null): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

export async function ingestOpenSky(): Promise<{ inserted: number }> {
  const client = new OpenSkyClient(
    process.env.OPENSKY_CLIENT_ID ?? null,
    process.env.OPENSKY_CLIENT_SECRET ?? null,
  );

  const data = await client.fetchRawStates(APPROACH_BOUNDS);
  if (!data?.states?.length) {
    return { inserted: 0 };
  }

  const pollId = crypto.randomUUID();
  const polledAt = new Date();

  const rows = data.states.map((state) => {
    const s = state as RawStateVector;

    return {
      pollId,
      polledAt,
      responseTime: data.time,
      icao24: (toString(s[0]) ?? '').trim(),
      callsign: toString(s[1])?.trim() ?? null,
      originCountry: toString(s[2]),
      timePosition: toNumber(s[3]),
      lastContact: toNumber(s[4]),
      longitude: toNumber(s[5]),
      latitude: toNumber(s[6]),
      baroAltitude: toNumber(s[7]),
      onGround: toBoolean(s[8]),
      velocity: toNumber(s[9]),
      trueTrack: toNumber(s[10]),
      verticalRate: toNumber(s[11]),
      sensors: Array.isArray(s[12]) ? s[12] : null,
      geoAltitude: toNumber(s[13]),
      squawk: toString(s[14]),
      spi: toBoolean(s[15]),
      positionSource: toNumber(s[16]),
    };
  });

  await db.insert(openskyStateVectors).values(rows);

  return { inserted: rows.length };
}
