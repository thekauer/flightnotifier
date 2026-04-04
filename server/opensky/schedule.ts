import type { ScheduledArrival, Flight } from '@/lib/types';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isLikelyInbound(f: Flight, airportIdent: string): boolean {
  if (f.onGround || f.speed <= 0) return false;
  return f.destination === airportIdent;
}

export function buildSchedule(
  flights: Flight[],
  approachingIds: Set<string>,
  airport: AirportSearchRecord,
): ScheduledArrival[] {
  return flights
    .filter((flight) => isLikelyInbound(flight, airport.ident))
    .map((f) => {
      const distKm = haversineKm(f.lat, f.lon, airport.latitude, airport.longitude);
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
        etaTimestampMs: f.timestamp + etaMinutes * 60_000,
        isBuitenveldertbaan: approachingIds.has(f.id),
      };
    })
    .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
}
