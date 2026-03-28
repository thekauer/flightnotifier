import type { Flight } from './types';

export interface ScheduledArrival {
  id: string;
  callsign: string;
  aircraftType: string | null;
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  originCountry: string;
  origin?: string;
  destination?: string;
  route?: string;
  altitude: number;
  speed: number;
  verticalRate: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isBuitenveldertbaan: boolean;
}

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Check if a flight is likely heading toward Schiphol */
function isLikelyInbound(f: Flight): boolean {
  if (f.onGround || f.speed <= 0) return false;
  // If destination is known, use it
  if (f.destination) return f.destination === 'EHAM';
  // Descending aircraft within reasonable distance
  const distKm = haversineKm(f.lat, f.lon, SCHIPHOL_LAT, SCHIPHOL_LON);
  if (distKm > 150) return false;
  // Must be descending, or low altitude and not climbing steeply
  return f.verticalRate < 0 || (f.alt < 10000 && f.verticalRate <= 500);
}

export function buildSchedule(
  flights: Flight[],
  approachingIds: Set<string>,
): ScheduledArrival[] {
  return flights
    .filter(isLikelyInbound)
    .map((f) => {
      const distKm = haversineKm(f.lat, f.lon, SCHIPHOL_LAT, SCHIPHOL_LON);
      const speedKmh = f.speed * 1.852; // knots to km/h
      const etaMinutes = speedKmh > 0 ? Math.round((distKm / speedKmh) * 60) : 999;
      return {
        id: f.id,
        callsign: f.callsign,
        aircraftType: f.aircraftType,
        manufacturer: f.manufacturer,
        registration: f.registration,
        owner: f.owner,
        originCountry: f.originCountry,
        origin: f.origin,
        destination: f.destination,
        route: f.route,
        altitude: f.alt,
        speed: f.speed,
        verticalRate: f.verticalRate,
        distanceToAmsKm: Math.round(distKm),
        estimatedMinutes: etaMinutes,
        isBuitenveldertbaan: approachingIds.has(f.id),
      };
    })
    .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
}
