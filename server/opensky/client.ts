import { fetchStateVectors, fetchOpenSkyToken } from '@/lib/api/opensky';
import type { BoundingBox, Flight } from './types';

export class OpenSkyClient {
  private clientId: string | null;
  private clientSecret: string | null;
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private lastFlights: Flight[] = [];

  constructor(clientId: string | null, clientSecret: string | null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async fetchStates(bounds: BoundingBox): Promise<Flight[]> {
    let token: string | null = null;
    if (this.clientId && this.clientSecret) {
      token = await this.getToken();
    }

    try {
      const flights = await fetchStateVectors(bounds, token);
      this.lastFlights = flights;
      return flights;
    } catch (err) {
      console.error(`[OpenSky]`, err);
      return this.lastFlights;
    }
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
