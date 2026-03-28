import type { Flight } from '../opensky/types';
import type { MetarData } from '@/lib/api/weather';
import type { ZoneBounds, VisibilityPrediction } from './types';
import { assessVisibilityAtAltitude } from './weatherFilter';

const KNOTS_TO_MPS = 0.514444;
const METERS_PER_DEG_LAT = 111320;

/**
 * Predict when (and if) a flight will enter the given zone rectangle.
 * Uses linear trajectory extrapolation — sufficient for ILS approaches.
 */
export function predictZoneEntry(
  flight: Flight,
  zone: ZoneBounds,
  weather: MetarData | null,
): VisibilityPrediction | null {
  // Skip grounded aircraft or those with no speed
  if (flight.onGround || flight.speed <= 0) return null;

  const speedMps = flight.speed * KNOTS_TO_MPS;
  const headingRad = flight.track * (Math.PI / 180);

  // Velocity in degrees per second
  const cosLat = Math.cos(flight.lat * (Math.PI / 180));
  if (cosLat === 0) return null;

  const dLatPerSec = (speedMps * Math.cos(headingRad)) / METERS_PER_DEG_LAT;
  const dLonPerSec = (speedMps * Math.sin(headingRad)) / (METERS_PER_DEG_LAT * cosLat);

  // Already in zone?
  const alreadyInZone =
    flight.lat >= zone.south &&
    flight.lat <= zone.north &&
    flight.lon >= zone.west &&
    flight.lon <= zone.east;

  let tEntry: number;

  if (alreadyInZone) {
    tEntry = 0;
  } else {
    // Find time to cross the relevant zone edge based on heading
    // For RWY 27 approaches (heading ~267°), aircraft move west (lon decreases)
    // so they enter through the east edge. But we handle all headings generically.
    const tEntries: number[] = [];

    // Time to reach east edge (entering from the east)
    if (dLonPerSec < 0 && flight.lon > zone.east) {
      tEntries.push((zone.east - flight.lon) / dLonPerSec);
    }
    // Time to reach west edge (entering from the west)
    if (dLonPerSec > 0 && flight.lon < zone.west) {
      tEntries.push((zone.west - flight.lon) / dLonPerSec);
    }
    // Time to reach north edge (entering from the north)
    if (dLatPerSec < 0 && flight.lat > zone.north) {
      tEntries.push((zone.north - flight.lat) / dLatPerSec);
    }
    // Time to reach south edge (entering from the south)
    if (dLatPerSec > 0 && flight.lat < zone.south) {
      tEntries.push((zone.south - flight.lat) / dLatPerSec);
    }

    if (tEntries.length === 0) return null;

    // To be inside the rectangle, aircraft must cross BOTH axes — entry time is the LATER crossing
    const validEntries = tEntries.filter((t) => t > 0);
    if (validEntries.length === 0) return null;
    tEntry = Math.max(...validEntries);
  }

  // Must enter within 15 minutes to be relevant
  if (tEntry > 15 * 60) return null;

  // Verify latitude at entry time is within zone bounds
  const latAtEntry = flight.lat + dLatPerSec * tEntry;
  if (latAtEntry < zone.south || latAtEntry > zone.north) return null;

  // Verify longitude at entry time is within zone bounds
  const lonAtEntry = flight.lon + dLonPerSec * tEntry;
  if (lonAtEntry < zone.west || lonAtEntry > zone.east) return null;

  // Altitude at entry (verticalRate is ft/min, tEntry is seconds)
  const altAtEntry = flight.alt + (flight.verticalRate * tEntry) / 60;
  if (altAtEntry < 0) return null; // would have landed before reaching zone

  // Minutes to landing
  const minutesToLanding =
    flight.alt > 0 && flight.verticalRate < 0
      ? flight.alt / Math.abs(flight.verticalRate)
      : Infinity;

  // Current distance to zone center in km
  const zoneCenterLat = (zone.south + zone.north) / 2;
  const zoneCenterLon = (zone.west + zone.east) / 2;
  const currentDistanceKm = haversineKm(flight.lat, flight.lon, zoneCenterLat, zoneCenterLon);

  // Weather-based visibility at predicted entry altitude
  const predictedVisibility = assessVisibilityAtAltitude(altAtEntry, weather);

  // Confidence assessment
  let confidence: VisibilityPrediction['confidence'] = 'high';
  if (tEntry > 10 * 60) confidence = 'low';
  else if (tEntry > 5 * 60) confidence = 'medium';

  // Go-around detection: climbing while supposedly approaching
  if (flight.verticalRate > 500) return null;

  return {
    flightId: flight.id,
    callsign: flight.callsign,
    aircraftType: flight.aircraftType,
    origin: flight.origin,
    secondsUntilZoneEntry: Math.round(tEntry),
    predictedEntryTime: Date.now() + tEntry * 1000,
    predictedAltitudeAtEntry: Math.round(altAtEntry),
    predictedVisibility,
    currentDistanceKm: Math.round(currentDistanceKm * 10) / 10,
    currentAltitude: flight.alt,
    minutesToLanding: isFinite(minutesToLanding) ? Math.round(minutesToLanding * 10) / 10 : -1,
    confidence,
    updatedAt: Date.now(),
  };
}

/**
 * Run predictions for all approaching flights against a zone.
 * Returns predictions sorted by secondsUntilZoneEntry ascending.
 */
export function predictAll(
  flights: Flight[],
  zone: ZoneBounds,
  weather: MetarData | null,
): VisibilityPrediction[] {
  const predictions: VisibilityPrediction[] = [];
  for (const flight of flights) {
    const prediction = predictZoneEntry(flight, zone, weather);
    if (prediction) predictions.push(prediction);
  }
  return predictions.sort((a, b) => a.secondsUntilZoneEntry - b.secondsUntilZoneEntry);
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
