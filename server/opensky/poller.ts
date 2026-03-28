import { OpenSkyClient } from './client';
import type { BoundingBox, Flight } from './types';

export class OpenSkyPoller {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private client: OpenSkyClient;
  private bounds: BoundingBox;
  private onUpdate: (flights: Flight[]) => void | Promise<void>;
  private intervalMs: number;
  private hasClients: () => boolean;

  constructor(config: {
    client: OpenSkyClient;
    bounds: BoundingBox;
    onUpdate: (flights: Flight[]) => void | Promise<void>;
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
    if (this.running) return;
    this.running = true;
    console.log(`[OpenSky] Polling every ${this.intervalMs / 1000}s`);
    this.scheduleNext(0);
  }

  stop(): void {
    this.running = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.timeoutId = setTimeout(async () => {
      await this.poll();
      this.scheduleNext(this.intervalMs);
    }, delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.hasClients()) {
      console.log('[OpenSky] No SSE clients, skipping poll');
      return;
    }

    try {
      const flights = await this.client.fetchStates(this.bounds);
      console.log(`[OpenSky] Fetched ${flights.length} flights`);
      await this.onUpdate(flights);
    } catch (err) {
      console.error('[OpenSky] Poll error:', err);
    }
  }
}
