import { fetchArrivals, type OpenSkyArrival } from '@/lib/api/opensky';
import type { ArrivalRecord } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: ArrivalRecord[];
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

/**
 * Fetch recent arrivals at EHAM from OpenSky Network, with 5-minute cache.
 * Returns normalized ArrivalRecords.
 *
 * NOTE: OpenSky arrivals endpoint only returns historical (batch-processed) data,
 * typically from the previous day or earlier. This is useful for building up
 * the runway history store but NOT for real-time predictions.
 */
export async function fetchRecentArrivals(
  token?: string | null,
): Promise<ArrivalRecord[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    // Query the last 24 hours of arrivals
    const end = Math.floor(Date.now() / 1000);
    const begin = end - 24 * 60 * 60;

    const raw = await fetchArrivals('EHAM', begin, end, token);
    const records: ArrivalRecord[] = raw.map((a: OpenSkyArrival) => ({
      icao24: a.icao24,
      callsign: (a.callsign ?? '').trim(),
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      estDepartureAirport: a.estDepartureAirport,
      estArrivalAirport: a.estArrivalAirport,
    }));

    cache = { data: records, fetchedAt: Date.now() };
    return records;
  } catch (err) {
    console.error('[ArrivalFetcher] Failed to fetch arrivals:', err);
    return cache?.data ?? [];
  }
}
