import {
  buildStateVectorsUrl,
  parseRawResponse,
  parseStateVectorsResponse,
  buildArrivalsUrl,
  parseArrivalsResponse,
  buildTrackUrl,
  parseTrackOkResponse,
  fetchOpenSkyToken,
  OPENSKY_TRACK_ENDPOINTS,
  type OpenSkyArrival,
  type OpenSkyTrackResponse,
  type OpenSkyResponse,
  OpenSkyHttpError,
} from '@/lib/api/opensky';
import type { BoundingBox, Flight } from './types';

const TOKEN_REFRESH_SKEW_MS = 60_000;

export class OpenSkyClient {
  private clientId: string | null;
  private clientSecret: string | null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private rateLimitUntil = 0;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(clientId: string | null, clientSecret: string | null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  private get hasCredentials(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private invalidateToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Obtain a new access token (client_credentials) and cache it in memory.
   * Concurrent callers share one in-flight refresh.
   */
  private async obtainFreshToken(): Promise<string | null> {
    if (!this.hasCredentials) return null;

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = (async () => {
      try {
        const data = await fetchOpenSkyToken(this.clientId!, this.clientSecret!);
        this.accessToken = data.access_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in ?? 1800) * 1000;
        console.log('[OpenSky] Token acquired, expires in', data.expires_in, 'seconds');
        return this.accessToken;
      } catch (err) {
        console.error('[OpenSky] Token request failed:', err);
        this.invalidateToken();
        return null;
      } finally {
        this.refreshInFlight = null;
      }
    })();

    return this.refreshInFlight;
  }

  /**
   * Return a valid cached token, or refresh when missing or near expiry.
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.hasCredentials) return null;

    const now = Date.now();
    if (
      this.accessToken &&
      now < this.tokenExpiresAt - TOKEN_REFRESH_SKEW_MS
    ) {
      return this.accessToken;
    }

    return this.obtainFreshToken();
  }

  /**
   * Shared OpenSky HTTP path: optional Bearer from cached client_credentials token,
   * refresh before expiry via getAccessToken(), and on 401/403 invalidate + refresh + retry once.
   */
  private async openSkyRequest(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);

    let sentAuth = false;
    if (this.hasCredentials) {
      const token = await this.getAccessToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        sentAuth = true;
      }
    }

    let res = await fetch(url, { ...init, headers });

    if (
      sentAuth &&
      (res.status === 401 || res.status === 403)
    ) {
      this.invalidateToken();
      const token = await this.obtainFreshToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
        res = await fetch(url, { ...init, headers });
      }
    }

    return res;
  }

  async fetchStates(bounds: BoundingBox): Promise<Flight[] | null> {
    if (Date.now() < this.rateLimitUntil) {
      return null;
    }

    const url = buildStateVectorsUrl(bounds);

    try {
      const res = await this.openSkyRequest(url);
      const flights = await parseStateVectorsResponse(res);
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

  async fetchRawStates(bounds: BoundingBox): Promise<OpenSkyResponse | null> {
    if (Date.now() < this.rateLimitUntil) {
      return null;
    }

    const url = buildStateVectorsUrl(bounds);

    try {
      const res = await this.openSkyRequest(url);
      const data = await parseRawResponse(res);
      this.rateLimitUntil = 0;
      return data;
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

  async fetchArrivals(airport: string, begin: number, end: number): Promise<OpenSkyArrival[]> {
    const url = buildArrivalsUrl(airport, begin, end);
    const res = await this.openSkyRequest(url);
    return parseArrivalsResponse(res);
  }

  async fetchTrack(icao24: string, time: number): Promise<OpenSkyTrackResponse | null> {
    for (let i = 0; i < OPENSKY_TRACK_ENDPOINTS.length; i++) {
      const endpoint = OPENSKY_TRACK_ENDPOINTS[i];
      const url = buildTrackUrl(endpoint, icao24, time);
      const res = await this.openSkyRequest(url);
      if (res.ok) {
        return parseTrackOkResponse(res);
      }
      if (res.status === 404 && i < OPENSKY_TRACK_ENDPOINTS.length - 1) {
        continue;
      }
      throw new OpenSkyHttpError(res.status, `OpenSky track HTTP ${res.status}: ${res.statusText}`);
    }
    return null;
  }
}
