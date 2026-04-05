import type { AirportCorridor } from '@/lib/airportCorridors';
import type { Flight } from '@/lib/types';
import { smoothPolyline } from '@/lib/mapSmoothing';

export interface FlightHistoryPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface LiveFlightCorridorGuidance {
  corridorId: string;
  movement: 'arrival' | 'departure';
  inferredRunway: string | null;
  path: [number, number][];
  distanceAlongKm: number;
}

const MAX_GUIDANCE_DISTANCE_KM = 140;
const MAX_ARRIVAL_ALTITUDE_FT = 14000;
const MAX_DEPARTURE_ALTITUDE_FT = 15000;
const MAX_MATCH_DISTANCE_KM = 8;
const CLIENT_GUIDANCE_SMOOTHING = 48;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(from: [number, number], to: [number, number]): number {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const deltaLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function headingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function averageDistanceForWindow(
  observed: [number, number][],
  corridor: [number, number][],
  startIndex: number,
): number {
  let total = 0;

  for (let index = 0; index < observed.length; index += 1) {
    const observedPoint = observed[index]!;
    const corridorPoint = corridor[startIndex + index]!;
    total += haversineKm(observedPoint[0], observedPoint[1], corridorPoint[0], corridorPoint[1]);
  }

  return total / observed.length;
}

function bestWindowScore(
  observed: [number, number][],
  corridor: [number, number][],
  track: number,
): { score: number; averageDistanceKm: number; endIndex: number } {
  if (corridor.length < observed.length) {
    return { score: Number.POSITIVE_INFINITY, averageDistanceKm: Number.POSITIVE_INFINITY, endIndex: 0 };
  }

  let bestScore = Number.POSITIVE_INFINITY;
  let bestAverageDistance = Number.POSITIVE_INFINITY;
  let bestEndIndex = 0;

  for (let startIndex = 0; startIndex <= corridor.length - observed.length; startIndex += 1) {
    const averageDistanceKm = averageDistanceForWindow(observed, corridor, startIndex);
    const corridorHeading =
      corridor.length >= startIndex + observed.length
        ? bearingDegrees(
            corridor[Math.max(startIndex + observed.length - 2, startIndex)]!,
            corridor[startIndex + observed.length - 1]!,
          )
        : track;
    const headingPenalty = headingDifference(track, corridorHeading) / 180;
    const score = averageDistanceKm + headingPenalty;

    if (score < bestScore) {
      bestScore = score;
      bestAverageDistance = averageDistanceKm;
      bestEndIndex = startIndex + observed.length - 1;
    }
  }

  return { score: bestScore, averageDistanceKm: bestAverageDistance, endIndex: bestEndIndex };
}

function cumulativeDistances(path: [number, number][]): number[] {
  const distances = [0];

  for (let index = 1; index < path.length; index += 1) {
    const prev = path[index - 1]!;
    const next = path[index]!;
    distances.push(distances[index - 1]! + haversineKm(prev[0], prev[1], next[0], next[1]));
  }

  return distances;
}

function nearestDistanceAlongPath(path: [number, number][], target: [number, number]): number {
  const distances = cumulativeDistances(path);
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestAlong = 0;

  for (let index = 0; index < path.length; index += 1) {
    const point = path[index]!;
    const distance = haversineKm(target[0], target[1], point[0], point[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestAlong = distances[index]!;
    }
  }

  return bestAlong;
}

function isEligibleForGuidance(
  flight: Flight,
  airportIdent: string,
  airportCenter: [number, number],
): 'arrival' | 'departure' | null {
  if (flight.onGround) {
    return null;
  }

  const distanceToAirportKm = haversineKm(flight.lat, flight.lon, airportCenter[0], airportCenter[1]);
  if (distanceToAirportKm > MAX_GUIDANCE_DISTANCE_KM) {
    return null;
  }

  if (flight.destination === airportIdent && flight.alt <= MAX_ARRIVAL_ALTITUDE_FT) {
    return 'arrival';
  }

  if (flight.origin === airportIdent && flight.alt <= MAX_DEPARTURE_ALTITUDE_FT) {
    return 'departure';
  }

  return null;
}

export function matchFlightToCorridor(args: {
  airportIdent: string;
  airportCenter: [number, number];
  flight: Flight;
  history: FlightHistoryPoint[];
  arrivals: AirportCorridor[];
  departures: AirportCorridor[];
}): LiveFlightCorridorGuidance | null {
  const movement = isEligibleForGuidance(args.flight, args.airportIdent, args.airportCenter);
  if (!movement) {
    return null;
  }

  const observed = args.history.slice(-5).map((point) => [point.lat, point.lon] as [number, number]);
  if (observed.length < 2) {
    return null;
  }

  const corridors = movement === 'arrival' ? args.arrivals : args.departures;
  let best:
    | {
        corridor: AirportCorridor;
        path: [number, number][];
        averageDistanceKm: number;
        endIndex: number;
        score: number;
      }
    | null = null;

  for (const corridor of corridors) {
    const path = smoothPolyline(
      corridor.averagePath.map((point) => [point.lat, point.lon] as [number, number]),
      CLIENT_GUIDANCE_SMOOTHING,
    );
    const windowScore = bestWindowScore(observed, path, args.flight.track);
    if (windowScore.averageDistanceKm > MAX_MATCH_DISTANCE_KM) {
      continue;
    }

    if (!best || windowScore.score < best.score) {
      best = {
        corridor,
        path,
        averageDistanceKm: windowScore.averageDistanceKm,
        endIndex: windowScore.endIndex,
        score: windowScore.score,
      };
    }
  }

  if (!best) {
    return null;
  }

  const snappedDistanceAlongKm = nearestDistanceAlongPath(best.path, [args.flight.lat, args.flight.lon]);

  return {
    corridorId: best.corridor.id,
    movement,
    inferredRunway: best.corridor.inferredRunway,
    path: best.path,
    distanceAlongKm: snappedDistanceAlongKm,
  };
}
