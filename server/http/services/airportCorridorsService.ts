import type { AirportCorridor, AirportCorridorsPayload, AirportCorridorPoint } from '@/lib/airportCorridors';
import type { AirportMovementFilter, AirportMovementTrack, AirportMovementType } from '@/lib/airportMovements';
import { getAirportMovements } from '@/server/http/services/airportMovementsService';

const DEFAULT_WINDOW_MINUTES = 10;
const RESAMPLED_POINT_COUNT = 14;
const GRID_SIZE_DEGREES = 0.04;
const MIN_CORRIDOR_POINT_ALTITUDE_FEET = 150;
const MIN_CORRIDOR_POINT_SPEED_KNOTS = 70;
const MIN_CORRIDOR_SAMPLE_COUNT = 3;

function clampWindowMinutes(value: number | null | undefined): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_WINDOW_MINUTES;
  }
  return Math.min(Math.max(Math.round(value), 3), 60);
}

function weatherBucket(track: AirportMovementTrack): string {
  const weather = track.weather;
  if (!weather) {
    return 'wx:unknown';
  }

  const dirBucket =
    weather.windDirection == null ? 'vrb' : `${Math.round(weather.windDirection / 30) * 30}`.padStart(3, '0');
  const speedBucket =
    weather.windSpeed == null ? 'unk' : weather.windSpeed < 5 ? 'calm' : weather.windSpeed < 15 ? 'light' : 'windy';
  return `${weather.flightCategory}:${dirBucket}:${speedBucket}`;
}

function gridBucket(value: number): number {
  return Math.round(value / GRID_SIZE_DEGREES);
}

function isMeaningfulFlightPoint(track: AirportMovementTrack['path'][number]): boolean {
  return (
    (track.altitude != null && track.altitude >= MIN_CORRIDOR_POINT_ALTITUDE_FEET) ||
    (track.speed != null && track.speed >= MIN_CORRIDOR_POINT_SPEED_KNOTS)
  );
}

function inferSegmentHeadingBucket(track: AirportMovementTrack): string {
  if (track.path.length < 2) {
    return 'hdg:unk';
  }

  const from = track.movement === 'departure' ? track.path[track.path.length - 2]! : track.path[0]!;
  const to = track.movement === 'departure' ? track.path[track.path.length - 1]! : track.path[1]!;
  const heading =
    to.heading ??
    from.heading ??
    ((Math.atan2(to.lon - from.lon, to.lat - from.lat) * 180) / Math.PI + 360) % 360;
  const bucket = Math.round(heading / 20) * 20;
  return `hdg:${String(bucket % 360).padStart(3, '0')}`;
}

function trimTrack(track: AirportMovementTrack, windowMinutes: number): AirportMovementTrack | null {
  const windowSeconds = windowMinutes * 60;
  const anchorIndex =
    track.movement === 'departure'
      ? track.path.findIndex((point) => isMeaningfulFlightPoint(point))
      : track.path.findLastIndex((point) => isMeaningfulFlightPoint(point));

  if (anchorIndex < 0) {
    return null;
  }

  const anchorTime = track.path[anchorIndex]!.time;
  const path = track.path.filter((point) =>
    track.movement === 'departure'
      ? point.time >= anchorTime && point.time <= anchorTime + windowSeconds
      : point.time >= anchorTime - windowSeconds && point.time <= anchorTime,
  );

  if (path.length < 3) {
    return null;
  }

  return {
    ...track,
    pointCount: path.length,
    firstSeen: path[0]!.time,
    lastSeen: path[path.length - 1]!.time,
    path,
  };
}

function resamplePath(track: AirportMovementTrack): AirportCorridorPoint[] {
  if (track.path.length <= RESAMPLED_POINT_COUNT) {
    return track.path.map((point) => ({ lat: point.lat, lon: point.lon }));
  }

  const result: AirportCorridorPoint[] = [];
  const lastIndex = track.path.length - 1;

  for (let i = 0; i < RESAMPLED_POINT_COUNT; i += 1) {
    const rawIndex = (i / (RESAMPLED_POINT_COUNT - 1)) * lastIndex;
    const lowerIndex = Math.floor(rawIndex);
    const upperIndex = Math.min(lastIndex, Math.ceil(rawIndex));
    const fraction = rawIndex - lowerIndex;
    const lower = track.path[lowerIndex]!;
    const upper = track.path[upperIndex]!;

    result.push({
      lat: lower.lat + (upper.lat - lower.lat) * fraction,
      lon: lower.lon + (upper.lon - lower.lon) * fraction,
    });
  }

  return result;
}

function corridorKey(track: AirportMovementTrack): string {
  const anchor = track.movement === 'departure' ? track.path[track.path.length - 1]! : track.path[0]!;
  return [
    track.movement,
    track.inferredRunway ?? 'RWY-UNK',
    weatherBucket(track),
    `g${gridBucket(anchor.lat)}:${gridBucket(anchor.lon)}`,
    inferSegmentHeadingBucket(track),
  ].join('|');
}

function averageResampledPaths(paths: AirportCorridorPoint[][]): AirportCorridorPoint[] {
  const maxLength = Math.max(...paths.map((path) => path.length));
  const result: AirportCorridorPoint[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    let latSum = 0;
    let lonSum = 0;
    let count = 0;

    for (const path of paths) {
      const point = path[Math.min(index, path.length - 1)];
      if (!point) continue;
      latSum += point.lat;
      lonSum += point.lon;
      count += 1;
    }

    if (count > 0) {
      result.push({
        lat: latSum / count,
        lon: lonSum / count,
      });
    }
  }

  return result;
}

function buildCorridors(tracks: AirportMovementTrack[], windowMinutes: number): AirportCorridor[] {
  const groups = new Map<string, { tracks: AirportMovementTrack[]; paths: AirportCorridorPoint[][] }>();

  for (const track of tracks) {
    if (
      track.movement === 'unknown' ||
      track.inferredRunway == null ||
      track.runwayConfidence === 'low' ||
      track.movementConfidence === 'low'
    ) {
      continue;
    }

    const trimmed = trimTrack(track, windowMinutes);
    if (!trimmed) {
      continue;
    }

    const key = corridorKey(trimmed);
    const entry = groups.get(key) ?? { tracks: [], paths: [] };
    entry.tracks.push(trimmed);
    entry.paths.push(resamplePath(trimmed));
    groups.set(key, entry);
  }

  return Array.from(groups.entries())
    .map(([key, entry]) => {
      const [movement, inferredRunway, weather] = key.split('|');
      const [weatherBucketValue] = [weather ?? 'wx:unknown'];
      return {
        id: key,
        movement: movement as AirportMovementType,
        inferredRunway: inferredRunway === 'RWY-UNK' ? null : inferredRunway,
        weatherBucket: weatherBucketValue,
        sampleCount: entry.tracks.length,
        averagePath: averageResampledPaths(entry.paths),
        sampleCallsigns: Array.from(new Set(entry.tracks.map((track) => track.callsign))).slice(0, 4),
        firstSeen: Math.min(...entry.tracks.map((track) => track.firstSeen)),
        lastSeen: Math.max(...entry.tracks.map((track) => track.lastSeen)),
      } satisfies AirportCorridor;
    })
    .filter((corridor) => corridor.sampleCount >= MIN_CORRIDOR_SAMPLE_COUNT && corridor.averagePath.length >= 3)
    .sort((a, b) => b.sampleCount - a.sampleCount || a.id.localeCompare(b.id));
}

export function resolveCorridorWindowMinutes(input: string | null | undefined): number {
  return clampWindowMinutes(input == null ? null : Number(input));
}

export async function getAirportCorridors(args: {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  windowMinutes: number;
}): Promise<AirportCorridorsPayload> {
  const movements = await getAirportMovements({
    airportIdent: args.airportIdent,
    date: args.date,
    movement: args.movement,
  });
  const corridors = buildCorridors(movements.tracks, args.windowMinutes);

  return {
    airportIdent: movements.airportIdent,
    airportName: movements.airportName,
    airportLatitude: movements.airportLatitude,
    airportLongitude: movements.airportLongitude,
    date: movements.date,
    timezone: movements.timezone,
    movement: movements.movement,
    windowMinutes: args.windowMinutes,
    corridorCount: corridors.length,
    sourceTrackCount: movements.tracks.length,
    weatherSamples: Array.from(
      new Map(
        movements.tracks
          .map((track) => track.weather)
          .filter((weather): weather is NonNullable<typeof weather> => weather != null)
          .map((weather) => [`${weather.station}-${weather.observationTime}`, weather]),
      ).values(),
    ).slice(0, 8),
    runwayGeometry: movements.runwayGeometry,
    corridors,
  };
}
