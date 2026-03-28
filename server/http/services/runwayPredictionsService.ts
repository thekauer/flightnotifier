import type { RunwayPrediction } from '@/lib/types';
import type { FlightState } from '@/server/state';

export function getRunwayPredictions(state: FlightState): RunwayPrediction[] {
  return state.runwayPredictions ?? [];
}
