import {
  fetchAircraftInfo as fetchAircraftInfoApi,
  fetchRouteInfo as fetchRouteInfoApi,
  type AircraftInfo,
  type RouteInfo,
} from '@/lib/api/adsbdb';

export type { AircraftInfo, RouteInfo };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEGATIVE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for not-found / errors

interface CacheEntry {
  info: AircraftInfo | null;
  fetchedAt: number;
}

interface RouteCacheEntry {
  info: RouteInfo | null;
  fetchedAt: number;
}

export class AdsbdbClient {
  private cache = new Map<string, CacheEntry>();
  private inflight = new Map<string, Promise<AircraftInfo | null>>();
  private routeCache = new Map<string, RouteCacheEntry>();
  private routeInflight = new Map<string, Promise<RouteInfo | null>>();

  /**
   * Look up aircraft info by ICAO24 hex address (mode-s code).
   * Returns cached data when available; deduplicates concurrent requests.
   */
  async getAircraftInfo(icao24: string): Promise<AircraftInfo | null> {
    const key = icao24.toLowerCase();

    // Check cache
    const cached = this.cache.get(key);
    if (cached) {
      const ttl = cached.info ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (Date.now() - cached.fetchedAt < ttl) {
        return cached.info;
      }
      this.cache.delete(key);
    }

    // Deduplicate concurrent requests for the same aircraft
    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this.fetchAircraft(key);
    this.inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  /**
   * Enrich a batch of ICAO24 addresses concurrently.
   * Returns a map from icao24 -> AircraftInfo (only for those found).
   */
  async enrichBatch(icao24s: string[]): Promise<Map<string, AircraftInfo>> {
    const results = new Map<string, AircraftInfo>();
    // Process in small batches to avoid hammering the API
    const BATCH_SIZE = 5;
    for (let i = 0; i < icao24s.length; i += BATCH_SIZE) {
      const batch = icao24s.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (id) => {
        const info = await this.getAircraftInfo(id);
        if (info) results.set(id.toLowerCase(), info);
      });
      await Promise.all(promises);
    }
    return results;
  }

  /**
   * Look up route info by callsign.
   * Returns cached data when available; deduplicates concurrent requests.
   */
  async getRouteInfo(callsign: string): Promise<RouteInfo | null> {
    const key = callsign.toUpperCase().trim();
    if (!key) return null;

    const cached = this.routeCache.get(key);
    if (cached) {
      const ttl = cached.info ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (Date.now() - cached.fetchedAt < ttl) {
        return cached.info;
      }
      this.routeCache.delete(key);
    }

    const existing = this.routeInflight.get(key);
    if (existing) return existing;

    const promise = this.fetchRoute(key);
    this.routeInflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.routeInflight.delete(key);
    }
  }

  /**
   * Enrich a batch of callsigns with route info concurrently.
   * Returns a map from callsign (uppercase) -> RouteInfo.
   */
  async enrichRoutes(callsigns: string[]): Promise<Map<string, RouteInfo>> {
    const results = new Map<string, RouteInfo>();
    const BATCH_SIZE = 5;
    for (let i = 0; i < callsigns.length; i += BATCH_SIZE) {
      const batch = callsigns.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (cs) => {
        const info = await this.getRouteInfo(cs);
        if (info) results.set(cs.toUpperCase().trim(), info);
      });
      await Promise.all(promises);
    }
    return results;
  }

  get cacheSize(): number {
    return this.cache.size;
  }

  private async fetchRoute(callsign: string): Promise<RouteInfo | null> {
    try {
      const info = await fetchRouteInfoApi(callsign);
      this.routeCache.set(callsign, { info, fetchedAt: Date.now() });
      return info;
    } catch (err) {
      console.warn(`[adsbdb] Route fetch failed for ${callsign}:`, err);
      this.routeCache.set(callsign, { info: null, fetchedAt: Date.now() });
      return null;
    }
  }

  private async fetchAircraft(icao24: string): Promise<AircraftInfo | null> {
    try {
      const info = await fetchAircraftInfoApi(icao24);
      this.cache.set(icao24, { info, fetchedAt: Date.now() });
      return info;
    } catch (err) {
      console.warn(`[adsbdb] Fetch failed for ${icao24}:`, err);
      this.cache.set(icao24, { info: null, fetchedAt: Date.now() });
      return null;
    }
  }
}
