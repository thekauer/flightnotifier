import type { HistoricalFlightPath } from '@/lib/types';
import { fetchHistoricalFlightPaths } from '@/server/opensky/history';

export interface FlightHistoryRequest {
  callsign: string;
  origin?: string;
  destination?: string;
}

export async function getFlightHistory(
  request: FlightHistoryRequest,
): Promise<HistoricalFlightPath[]> {
  return fetchHistoricalFlightPaths(request);
}
