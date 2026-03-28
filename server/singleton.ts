import { FlightStateManager } from './state';
import { OpenSkyClient } from './opensky/client';
import { OpenSkyPoller } from './opensky/poller';
import { AdsbdbClient } from './adsbdb/client';
import type { BoundingBox } from './opensky/types';
import { fetchMetar, type MetarData } from '@/lib/api/weather';
import { RunwayHistoryStore } from './runway/historyStore';
import { predictRunways } from './runway/predictor';

const APPROACH_BOUNDS: BoundingBox = { lamin: 52.2, lomin: 4.6, lamax: 52.45, lomax: 5.1 };

// --- Weather cache with 5-minute TTL ----------------------------------------

const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;

export class WeatherCache {
  private data: MetarData | null = null;
  private fetchPromise: Promise<MetarData | null> | null = null;

  async get(): Promise<MetarData | null> {
    if (this.data && Date.now() - this.data.fetchedAt < WEATHER_CACHE_TTL_MS) {
      return this.data;
    }
    // Deduplicate concurrent fetches
    if (this.fetchPromise) return this.fetchPromise;
    this.fetchPromise = this.refresh();
    try {
      return await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async refresh(): Promise<MetarData | null> {
    try {
      this.data = await fetchMetar('EHAM');
      return this.data;
    } catch (err) {
      console.error('[WeatherCache] METAR fetch failed:', err);
      // Return stale data if available
      return this.data;
    }
  }

  getCached(): MetarData | null {
    return this.data;
  }
}

// --- Globals -----------------------------------------------------------------

const globalForApp = globalThis as unknown as {
  stateManager: FlightStateManager | undefined;
  poller: OpenSkyPoller | undefined;
  adsbdbClient: AdsbdbClient | undefined;
  weatherCache: WeatherCache | undefined;
  weatherInterval: ReturnType<typeof setInterval> | undefined;
  sseClientCount: number | undefined;
  runwayHistoryStore: RunwayHistoryStore | undefined;
};

export function getAdsbdbClient(): AdsbdbClient {
  if (!globalForApp.adsbdbClient) {
    globalForApp.adsbdbClient = new AdsbdbClient();
  }
  return globalForApp.adsbdbClient;
}

export function getWeatherCache(): WeatherCache {
  if (!globalForApp.weatherCache) {
    globalForApp.weatherCache = new WeatherCache();
    // Kick off initial fetch + start background polling every 5 minutes
    globalForApp.weatherCache.get();
    globalForApp.weatherInterval = setInterval(() => {
      globalForApp.weatherCache?.get();
    }, WEATHER_CACHE_TTL_MS);
  }
  return globalForApp.weatherCache;
}

export function getRunwayHistoryStore(): RunwayHistoryStore {
  if (!globalForApp.runwayHistoryStore) {
    globalForApp.runwayHistoryStore = new RunwayHistoryStore();
  }
  return globalForApp.runwayHistoryStore;
}

export function getStateManager(): FlightStateManager {
  if (!globalForApp.stateManager) {
    globalForApp.stateManager = new FlightStateManager();

    // Wire approach recording to history store
    const historyStore = getRunwayHistoryStore();
    globalForApp.stateManager.setOnApproachConfirmed((record) => {
      historyStore.record({
        callsign: record.callsign,
        runway: record.runway,
        timestamp: record.timestamp,
        heading: record.heading,
        lat: record.lat,
        lon: record.lon,
      });
      console.log(`[RunwayHistory] Recorded ${record.callsign} on RWY ${record.runway}`);
    });
  }
  return globalForApp.stateManager;
}

export function getPoller(): OpenSkyPoller {
  if (!globalForApp.poller) {
    const stateManager = getStateManager();
    const client = new OpenSkyClient(
      process.env.OPENSKY_CLIENT_ID || null,
      process.env.OPENSKY_CLIENT_SECRET || null,
    );
    globalForApp.sseClientCount = 0;

    const adsbdb = getAdsbdbClient();

    globalForApp.poller = new OpenSkyPoller({
      client,
      bounds: APPROACH_BOUNDS,
      onUpdate: async (flights) => {
        // Enrich flights with adsbdb aircraft info (non-blocking for cached entries)
        const needEnrichment = flights.filter(
          (f) => !f.onGround && f.aircraftType === null,
        );
        if (needEnrichment.length > 0) {
          const ids = needEnrichment.map((f) => f.id);
          const infoMap = await adsbdb.enrichBatch(ids);
          for (const flight of flights) {
            const info = infoMap.get(flight.id.toLowerCase());
            if (info) {
              flight.aircraftType = info.icaoType;
              flight.manufacturer = info.manufacturer;
              flight.registration = info.registration ?? flight.registration;
              flight.owner = info.owner;
            }
          }
        }

        // Enrich flights with route info by callsign
        const needRoutes = flights.filter(
          (f) => !f.onGround && f.callsign && !f.origin,
        );
        if (needRoutes.length > 0) {
          const callsigns = needRoutes.map((f) => f.callsign);
          const routeMap = await adsbdb.enrichRoutes(callsigns);
          for (const flight of flights) {
            const routeInfo = routeMap.get(flight.callsign.toUpperCase().trim());
            if (routeInfo) {
              flight.origin = routeInfo.origin ?? undefined;
              flight.destination = routeInfo.destination ?? undefined;
              flight.route = routeInfo.route ?? undefined;
            }
          }
        }

        // Compute runway predictions BEFORE update so SSE includes them
        const weather = getWeatherCache().getCached();
        const historyStore = getRunwayHistoryStore();
        const recentTimestamps = stateManager.getRecentApproachDirections();
        const predictions = predictRunways(flights, weather, historyStore, recentTimestamps);

        stateManager.update(flights, predictions);
      },
      intervalMs: parseInt(process.env.OPENSKY_POLL_INTERVAL_MS || '90000', 10),
      hasClients: () => (globalForApp.sseClientCount ?? 0) > 0,
    });
    globalForApp.poller.start();
  }
  return globalForApp.poller;
}

export function incrementSSEClients(): void {
  globalForApp.sseClientCount = (globalForApp.sseClientCount ?? 0) + 1;
}

export function decrementSSEClients(): void {
  globalForApp.sseClientCount = Math.max(0, (globalForApp.sseClientCount ?? 1) - 1);
}
