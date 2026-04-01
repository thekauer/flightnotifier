import type { HistoricalFlightPath, HistoricalTrackPoint } from '@/lib/types';
import { getOpenSkyClient } from '@/server/singleton';
import { pathIntersectsApproachCone27 } from '@/lib/approachCone';

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;
const HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;
const HISTORY_WINDOW_SECONDS = 24 * 60 * 60;
const MAX_HISTORY_RESULTS = 5;

interface HistoryCacheEntry {
  fetchedAt: number;
  data: HistoricalFlightPath[];
}

const historyCache = new Map<string, HistoryCacheEntry>();

function normalizeCallsign(callsign: string | null | undefined): string {
  return (callsign ?? '').replace(/\s+/g, '').toUpperCase();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function selectLandingSegment(
  path: [number, number | null, number | null, number | null, number | null, boolean][]
): HistoricalTrackPoint[] {
  const points = path
    .filter((point) => point[1] != null && point[2] != null)
    .map((point) => ({
      time: point[0],
      lat: point[1] as number,
      lon: point[2] as number,
      altitude: point[3],
      heading: point[4],
      onGround: point[5],
    }));

  const nearAmsterdam = points.filter((point) => haversineKm(point.lat, point.lon, SCHIPHOL_LAT, SCHIPHOL_LON) <= 120);
  if (nearAmsterdam.length > 0) {
    return nearAmsterdam;
  }

  return points.slice(-40);
}

function buildCacheKey(callsign: string, origin?: string, destination?: string): string {
  return [normalizeCallsign(callsign), origin ?? '', destination ?? ''].join('|');
}

export async function fetchHistoricalFlightPaths(args: {
  callsign: string;
  origin?: string;
  destination?: string;
}): Promise<HistoricalFlightPath[]> {
  const { callsign, origin, destination } = args;
  const cacheKey = buildCacheKey(callsign, origin, destination);
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL_MS) {
    return cached.data;
  }

  const client = getOpenSkyClient();
  const end = Math.floor(Date.now() / 1000);
  const begin = end - HISTORY_WINDOW_SECONDS;
  let arrivals;
  try {
    arrivals = await client.fetchArrivals(destination ?? 'EHAM', begin, end);
  } catch (error) {
    console.error('[HistoricalFlightPaths] Failed to fetch arrivals:', error, {
      destination: destination ?? 'EHAM',
      begin,
      end,
    });
    return [];
  }

  const targetCallsign = normalizeCallsign(callsign);
  const exactMatches = arrivals.filter(
    (arrival) =>
      normalizeCallsign(arrival.callsign) === targetCallsign &&
      (origin ? arrival.estDepartureAirport === origin : true) &&
      (destination ? arrival.estArrivalAirport === destination : true)
  );
  const relaxedMatches =
    exactMatches.length > 0
      ? exactMatches
      : arrivals.filter((arrival) => normalizeCallsign(arrival.callsign) === targetCallsign);

  const selected = relaxedMatches.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, MAX_HISTORY_RESULTS);

  const results: HistoricalFlightPath[] = [];
  for (const arrival of selected) {
    let track;
    try {
      track = await client.fetchTrack(arrival.icao24, arrival.lastSeen);
    } catch (error) {
      console.error('[HistoricalFlightPaths] Failed to fetch track:', error);
      continue;
    }
    if (!track?.path || track.path.length === 0) {
      continue;
    }

    const landingSegment = selectLandingSegment(track.path);
    if (landingSegment.length === 0) {
      continue;
    }

    results.push({
      icao24: arrival.icao24,
      callsign: normalizeCallsign(arrival.callsign),
      firstSeen: arrival.firstSeen,
      lastSeen: arrival.lastSeen,
      origin: arrival.estDepartureAirport,
      destination: arrival.estArrivalAirport,
      interceptedCone: pathIntersectsApproachCone27(landingSegment),
      path: landingSegment,
    });
  }

  historyCache.set(cacheKey, {
    fetchedAt: Date.now(),
    data: results,
  });

  return results;
}
