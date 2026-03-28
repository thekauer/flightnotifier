import { FlightStateManager } from './state';
import { OpenSkyClient } from './opensky/client';
import { OpenSkyPoller } from './opensky/poller';
import type { BoundingBox } from './opensky/types';

const APPROACH_BOUNDS: BoundingBox = { lamin: 52.2, lomin: 4.6, lamax: 52.45, lomax: 5.1 };

const globalForApp = globalThis as unknown as {
  stateManager: FlightStateManager | undefined;
  poller: OpenSkyPoller | undefined;
  sseClientCount: number | undefined;
};

export function getStateManager(): FlightStateManager {
  if (!globalForApp.stateManager) {
    globalForApp.stateManager = new FlightStateManager();
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

    globalForApp.poller = new OpenSkyPoller({
      client,
      bounds: APPROACH_BOUNDS,
      onUpdate: (flights) => stateManager.update(flights),
      intervalMs: parseInt(process.env.OPENSKY_POLL_INTERVAL_MS || '15000', 10),
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
