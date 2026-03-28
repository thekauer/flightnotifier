import type { VisibilityPrediction, ZoneBounds } from '@/server/visibility/types';
import type { FlightState } from '@/server/state';
import type { MetarData } from '@/lib/api/weather';
import { predictAll } from '@/server/visibility/predictor';

export function getVisibilityPredictions(
  state: FlightState,
  zoneBounds: ZoneBounds,
  weather: MetarData | null,
): VisibilityPrediction[] {
  return predictAll(state.approachingFlights, zoneBounds, weather);
}
