import type { MetarData } from '@/lib/api/weather';
import type { FlightState } from '@/server/state';

export function buildStateResponse(state: FlightState, weather: MetarData | null) {
  return {
    ...state,
    weather,
  };
}
