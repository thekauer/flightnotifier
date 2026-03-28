import type { BoundingBox, Flight } from './types';

const OPENSKY_BASE_URL = 'https://opensky-network.org/api';

const METERS_TO_FEET = 3.28084;
const MS_TO_KNOTS = 1.94384;
const MS_TO_FTMIN = 196.85;

interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | number[] | null)[][] | null;
}

export class OpenSkyClient {
  private clientId: string | null;
  private clientSecret: string | null;
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(clientId: string | null, clientSecret: string | null) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async fetchStates(bounds: BoundingBox): Promise<Flight[]> {
    const headers: Record<string, string> = {};
    if (this.clientId && this.clientSecret) {
      const token = await this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
    url.searchParams.set('lamin', String(bounds.lamin));
    url.searchParams.set('lomin', String(bounds.lomin));
    url.searchParams.set('lamax', String(bounds.lamax));
    url.searchParams.set('lomax', String(bounds.lomax));

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      console.error(`[OpenSky] HTTP ${res.status}: ${res.statusText}`);
      return [];
    }

    const data: OpenSkyResponse = await res.json();
    if (!data.states) return [];
    console.log({ data });

    return data.states
      .filter((s) => s[5] != null && s[6] != null) // filter out null lat/lon
      .map((s) => this.parseStateVector(s, data.time));
  }

  private parseStateVector(s: (string | number | boolean | number[] | null)[], responseTime: number): Flight {
    console.log('parsing', s);
    const baroAlt = s[7] as number | null;
    const geoAlt = s[13] as number | null;
    const altMeters = baroAlt ?? geoAlt ?? 0;
    const velocityMs = (s[9] as number | null) ?? 0;
    const vertRateMs = (s[11] as number | null) ?? 0;

    return {
      id: (s[0] as string).trim(),
      callsign: ((s[1] as string | null) ?? '').trim(),
      lat: s[6] as number,
      lon: s[5] as number,
      alt: Math.round(altMeters * METERS_TO_FEET),
      speed: Math.round(velocityMs * MS_TO_KNOTS),
      track: Math.round((s[10] as number | null) ?? 0),
      verticalRate: Math.round(vertRateMs * MS_TO_FTMIN),
      onGround: (s[8] as boolean) ?? false,
      timestamp: (s[3] as number | null) ?? responseTime,
      aircraftType: null, // OpenSky /states/all doesn't include this
      registration: null, // will be enriched later if available
      originCountry: (s[2] as string) ?? '',
    };
  }

  private async getToken(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.token;
    }

    try {
      const res = await fetch('https://opensky-network.org/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
        }),
      });

      if (!res.ok) {
        console.error(`[OpenSky] Auth failed: ${res.status} ${res.statusText}`);
        this.token = null;
        return null;
      }

      const data = await res.json();
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
