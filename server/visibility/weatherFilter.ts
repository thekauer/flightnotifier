import { getVisibilityLevel, type MetarData } from '@/lib/api/weather';
import { mapVisibilityLevel } from './types';
import type { VisibilityPrediction } from './types';

/**
 * Assess predicted visibility for an aircraft at a given altitude,
 * wrapping the existing getVisibilityLevel with prediction-specific mapping.
 *
 * - clear  -> 'visible'
 * - partial -> 'partially_visible'
 * - obscured -> 'obscured'
 *
 * Clouds matter, not darkness — aircraft lights are visible at night.
 */
export function assessVisibilityAtAltitude(
  altitudeFt: number,
  weather: MetarData | null,
): VisibilityPrediction['predictedVisibility'] {
  const level = getVisibilityLevel(altitudeFt, weather);
  return mapVisibilityLevel(level);
}

/**
 * Compute effective visual range in meters, considering surface visibility.
 * Useful for UI distance indicators.
 */
export function effectiveVisualRangeMeters(
  distanceToZoneEdgeKm: number,
  weather: MetarData | null,
): number {
  if (!weather || weather.visibility === null) {
    // No weather data — assume unlimited
    return distanceToZoneEdgeKm * 1000;
  }
  // Weather visibility is in statute miles, convert to meters
  const weatherVisMeters = weather.visibility * 1609.34;
  return Math.min(distanceToZoneEdgeKm * 1000, weatherVisMeters);
}
