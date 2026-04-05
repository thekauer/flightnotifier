import type { CorridorMatchCandidate, CorridorMatchResult, CorridorMatcherPoint } from '@/lib/corridorMatcher';
import type { AirportMovementFilter } from '@/lib/airportMovements';
import { getAirportCorridors } from '@/server/http/services/airportCorridorsService';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function averageDistanceForWindow(
  observed: CorridorMatcherPoint[],
  corridor: CorridorMatcherPoint[],
  startIndex: number,
): number {
  let total = 0;

  for (let i = 0; i < observed.length; i += 1) {
    const corridorPoint = corridor[startIndex + i]!;
    const observedPoint = observed[i]!;
    total += haversineKm(observedPoint.lat, observedPoint.lon, corridorPoint.lat, corridorPoint.lon);
  }

  return total / observed.length;
}

function bestAverageDistance(
  observed: CorridorMatcherPoint[],
  corridor: CorridorMatcherPoint[],
): number {
  if (observed.length === 0 || corridor.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  if (corridor.length <= observed.length) {
    return averageDistanceForWindow(observed.slice(0, corridor.length), corridor, 0);
  }

  let best = Number.POSITIVE_INFINITY;
  const maxStart = corridor.length - observed.length;

  for (let startIndex = 0; startIndex <= maxStart; startIndex += 1) {
    best = Math.min(best, averageDistanceForWindow(observed, corridor, startIndex));
  }

  return best;
}

function confidenceFromDistances(best: number, secondBest: number): 'high' | 'medium' | 'low' {
  if (best <= 0.6 && secondBest - best >= 0.35) {
    return 'high';
  }
  if (best <= 1.2 && secondBest - best >= 0.15) {
    return 'medium';
  }
  return 'low';
}

export async function matchObservedPathToCorridors(args: {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  points: CorridorMatcherPoint[];
  windowMinutes?: number;
}): Promise<CorridorMatchResult> {
  const observed = args.points.filter(
    (point) =>
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon),
  );

  if (observed.length < 2) {
    return {
      airportIdent: args.airportIdent,
      date: args.date,
      movement: args.movement,
      observedPointCount: observed.length,
      bestMatch: null,
      candidates: [],
    };
  }

  const corridors = await getAirportCorridors({
    airportIdent: args.airportIdent,
    date: args.date,
    movement: args.movement,
    windowMinutes: args.windowMinutes ?? 10,
  });

  const candidates = corridors.corridors
    .map((corridor): CorridorMatchCandidate => {
      const averageDistanceKm = bestAverageDistance(observed, corridor.averagePath);
      const score = averageDistanceKm / Math.max(1, corridor.sampleCount / 3);

      return {
        corridorId: corridor.id,
        movement: corridor.movement,
        inferredRunway: corridor.inferredRunway,
        weatherBucket: corridor.weatherBucket,
        sampleCount: corridor.sampleCount,
        score,
        averageDistanceKm,
        confidence: 'low',
      };
    })
    .sort((a, b) => a.score - b.score);

  const best = candidates[0] ?? null;
  const secondBest = candidates[1]?.averageDistanceKm ?? Number.POSITIVE_INFINITY;

  if (best) {
    best.confidence = confidenceFromDistances(best.averageDistanceKm, secondBest);
  }

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    if (candidate.averageDistanceKm <= (best?.averageDistanceKm ?? Number.POSITIVE_INFINITY) + 0.2) {
      candidate.confidence = 'medium';
    }
  }

  return {
    airportIdent: args.airportIdent,
    date: args.date,
    movement: args.movement,
    observedPointCount: observed.length,
    bestMatch: best,
    candidates: candidates.slice(0, 8),
  };
}
