import type { LiveFeedFlight } from './proto.js';

export interface ScheduledArrival {
  flightId: number;
  flightNumber: string;
  callsign: string;
  origin: string;
  aircraftType: string;
  registration: string;
  altitude: number;
  speed: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isOnRunway09: boolean;
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

export function buildSchedule(
  flights: LiveFeedFlight[],
  approachingIds: Set<number>,
): ScheduledArrival[] {
  return flights
    .filter((f) => f.extraInfo?.route?.to === 'AMS' && !f.onGround && f.speed > 0)
    .map((f) => {
      const distKm = haversineKm(f.lat, f.lon, SCHIPHOL_LAT, SCHIPHOL_LON);
      const speedKmh = f.speed * 1.852;
      const etaMinutes = speedKmh > 0 ? Math.round((distKm / speedKmh) * 60) : 999;
      return {
        flightId: f.flightId,
        flightNumber: f.extraInfo?.flight || '',
        callsign: f.callsign,
        origin: f.extraInfo?.route?.from || '?',
        aircraftType: f.extraInfo?.type || '?',
        registration: f.extraInfo?.reg || '',
        altitude: f.alt,
        speed: f.speed,
        distanceToAmsKm: Math.round(distKm),
        estimatedMinutes: etaMinutes,
        isOnRunway09: approachingIds.has(f.flightId),
      };
    })
    .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
}
