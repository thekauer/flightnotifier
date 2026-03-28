import { fetchStateVectors, fetchOpenSkyToken, OpenSkyHttpError } from '@/lib/api/opensky';
import type { BoundingBox, Flight } from './types';

export class OpenSkyClient {
  private clientId: string | null;
  private clientSecret: string | null;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private rateLimitUntil = 0;

  constructor(clientId: string | null, clientSecret: string | null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async fetchStates(bounds: BoundingBox): Promise<Flight[] | null> {
    if (Date.now() < this.rateLimitUntil) {
      return null;
    }

    let token: string | null = null;
    if (this.clientId && this.clientSecret) {
      token = await this.getToken();
    }

    try {
      const flights = await fetchStateVectors(bounds, token);
      this.rateLimitUntil = 0;
      return flights;
    } catch (err) {
      if (err instanceof OpenSkyHttpError && err.status === 429) {
        const retryAfterMs = Math.max((err.retryAfterSeconds ?? 300) * 1000, 60_000);
        this.rateLimitUntil = Date.now() + retryAfterMs;
        console.warn(
          `[OpenSky] Rate limited. Backing off for ${Math.round(retryAfterMs / 1000)}s`,
        );
      } else {
        console.error('[OpenSky]', err);
      }
      return null;
    }
  }

  getNextPollDelayMs(baseIntervalMs: number): number {
    if (Date.now() < this.rateLimitUntil) {
      return Math.max(baseIntervalMs, this.rateLimitUntil - Date.now());
    }
    return baseIntervalMs;
  }

  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    try {
      const data = await fetchOpenSkyToken(this.clientId!, this.clientSecret!);
      this.token = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in ?? 1800) * 1000;
      console.log('[OpenSky] Token acquired, expires in', data.expires_in, 'seconds');
      return this.token;
    } catch (err) {
      console.error('[OpenSky] Token request failed:', err);
      this.token = null;
      return null;
    }
  }
}
