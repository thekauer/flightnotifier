import type { MetarData } from '@/lib/api/weather';
import type { Flight } from '@/server/opensky/types';
import type { RunwayHistoryStore } from './historyStore';
import type { RunwayPrediction, RunwayDirection } from './types';
import type { ApproachDirection } from './signals';
import { windSignal, historySignal, timeOfDaySignal, activeConfigSignal } from './signals';

const WEIGHT_WIND = 0.45;
const WEIGHT_HISTORY = 0.25;
const WEIGHT_TIME_OF_DAY = 0.15;
const WEIGHT_ACTIVE_CONFIG = 0.15;

function determineConfidence(probability: number): 'high' | 'medium' | 'low' {
  if (probability >= 0.7) return 'high';
  if (probability >= 0.4) return 'medium';
  return 'low';
}

/**
 * Predict which runway direction each approaching flight will use.
 *
 * The probability returned is for the PREDICTED runway direction.
 * If rwy27Probability >= 0.5, we predict RWY 27 with that probability.
 * If rwy27Probability < 0.5, we predict RWY 09 with (1 - rwy27Probability).
 */
// Schiphol coordinates
const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;
const MAX_DISTANCE_KM = 100;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Filter to only flights likely inbound to EHAM */
function isLikelyInbound(f: Flight): boolean {
  if (f.onGround || f.speed <= 0) return false;
  // If destination is known, use it
  if (f.destination) {
    return f.destination === 'EHAM';
  }
  // Otherwise: must be descending or within reasonable distance and not climbing
  const distKm = haversineKm(f.lat, f.lon, SCHIPHOL_LAT, SCHIPHOL_LON);
  if (distKm > MAX_DISTANCE_KM) return false;
  // Descending aircraft, or low altitude aircraft not climbing steeply
  return f.verticalRate < 0 || (f.alt < 10000 && f.verticalRate <= 500);
}

export function predictRunways(
  flights: Flight[],
  weather: MetarData | null,
  historyStore: RunwayHistoryStore,
  recentApproachDirections: ApproachDirection[],
): RunwayPrediction[] {
  const wind = windSignal(weather);
  const tod = timeOfDaySignal();
  const active = activeConfigSignal(recentApproachDirections);

  return flights
    .filter(isLikelyInbound)
    .map((f) => {
      const history = historySignal(f.callsign, historyStore);

      // Weighted sum: probability that RWY 27 is the active runway
      const rwy27Probability =
        WEIGHT_WIND * wind +
        WEIGHT_HISTORY * history +
        WEIGHT_TIME_OF_DAY * tod +
        WEIGHT_ACTIVE_CONFIG * active;

      // Pick the more likely runway
      const runway: RunwayDirection = rwy27Probability >= 0.5 ? '27' : '09';
      const probability = runway === '27' ? rwy27Probability : 1 - rwy27Probability;

      return {
        flightId: f.id,
        callsign: f.callsign,
        runway,
        probability: Math.round(probability * 100) / 100,
        confidence: determineConfidence(probability),
        signals: {
          wind: Math.round(wind * 100) / 100,
          history: Math.round(history * 100) / 100,
          timeOfDay: Math.round(tod * 100) / 100,
          activeConfig: Math.round(active * 100) / 100,
        },
        updatedAt: Date.now(),
      };
    });
}
