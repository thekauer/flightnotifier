import { OpenSkyClient } from './client';
import type { BoundingBox, Flight } from './types';

export class OpenSkyPoller {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private client: OpenSkyClient;
  private bounds: BoundingBox;
  private onUpdate: (flights: Flight[]) => void;
  private intervalMs: number;
  private hasClients: () => boolean;

  constructor(config: {
    client: OpenSkyClient;
    bounds: BoundingBox;
    onUpdate: (flights: Flight[]) => void;
    intervalMs: number;
    hasClients: () => boolean;
  }) {
    this.client = config.client;
    this.bounds = config.bounds;
    this.onUpdate = config.onUpdate;
    this.intervalMs = config.intervalMs;
    this.hasClients = config.hasClients;
  }

  start(): void {
    console.log(`[OpenSky] Polling every ${this.intervalMs / 1000}s`);
    this.poll();
    this.intervalId = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.hasClients()) {
      console.log('[OpenSky] No SSE clients, skipping poll');
      return;
    }

    try {
      const flights = await this.client.fetchStates(this.bounds);
      console.log(`[OpenSky] Fetched ${flights.length} flights`);
      this.onUpdate(flights);
    } catch (err) {
      console.error('[OpenSky] Poll error:', err);
    }
  }
}
