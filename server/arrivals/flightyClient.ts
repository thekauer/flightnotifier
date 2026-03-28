import { extractInitialFlightsFromHtml } from './parseHtml';
import type { FlightyArrivalRow } from './types';

const DEFAULT_URL = 'https://flighty.com/airports/amsterdam-schiphol-ams/arrivals';
const DEFAULT_TTL_MS = 90_000;

export interface FlightyArrivalsResult {
  rows: FlightyArrivalRow[];
  fetchedAtMs: number;
}

interface CacheEntry {
  result: FlightyArrivalsResult;
  expiresAtMs: number;
}

const globalForFlighty = globalThis as unknown as {
  flightyArrivalsCache?: CacheEntry;
  flightyArrivalsInflight?: Promise<FlightyArrivalsResult | null> | undefined;
};

function getCache(): CacheEntry | undefined {
  return globalForFlighty.flightyArrivalsCache;
}

function setCache(entry: CacheEntry): void {
  globalForFlighty.flightyArrivalsCache = entry;
}

function getTtlMs(): number {
  const raw = process.env.FLIGHTY_CACHE_TTL_MS;
  if (raw) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 5_000 && n <= 600_000) return n;
  }
  return DEFAULT_TTL_MS;
}

function getUrl(): string {
  return process.env.FLIGHTY_AMS_ARRIVALS_URL?.trim() || DEFAULT_URL;
}

async function fetchFresh(): Promise<FlightyArrivalsResult | null> {
  const url = getUrl();
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'FlightNotifier/1.0 (+https://github.com; schedule reader)',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error(`[Flighty] HTTP ${res.status} fetching ${url}`);
    return null;
  }
  const html = await res.text();
  const rows = extractInitialFlightsFromHtml(html);
  if (!rows || rows.length === 0) {
    console.error('[Flighty] No initialFlights array parsed from HTML');
    return null;
  }
  return { rows, fetchedAtMs: Date.now() };
}

/**
 * Cached Flighty AMS arrivals (HTML scrape). Returns null on fetch/parse failure.
 */
export async function getFlightyArrivals(): Promise<FlightyArrivalsResult | null> {
  const ttl = getTtlMs();
  const cached = getCache();
  if (cached && Date.now() < cached.expiresAtMs) {
    return cached.result;
  }

  if (globalForFlighty.flightyArrivalsInflight) {
    return globalForFlighty.flightyArrivalsInflight;
  }

  const promise = fetchFresh()
    .then((result) => {
      if (result) {
        setCache({ result, expiresAtMs: Date.now() + ttl });
      }
      return result;
    })
    .finally(() => {
      globalForFlighty.flightyArrivalsInflight = undefined;
    });

  globalForFlighty.flightyArrivalsInflight = promise;
  return promise;
}
