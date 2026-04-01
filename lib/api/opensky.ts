import type { Flight } from '@/lib/types';

export const OPENSKY_BASE_URL = 'https://opensky-network.org/api';
export const OPENSKY_AUTH_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

/** Endpoints tried in order for historical track lookup (OpenSky docs vary). */
export const OPENSKY_TRACK_ENDPOINTS = ['/tracks', '/tracks/all'] as const;

const METERS_TO_FEET = 3.28084;
const MS_TO_KNOTS = 1.94384;
const MS_TO_FTMIN = 196.85;

export interface OpenSkyBoundingBox {
  lamin: number; // south
  lomin: number; // west
  lamax: number; // north
  lomax: number; // east
}

export interface OpenSkyResponse {
  time: number;
  states: (string | number | boolean | number[] | null)[][] | null;
}

export interface OpenSkyTokenResponse {
  access_token: string;
  expires_in?: number;
}

export class OpenSkyHttpError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  remainingCredits: number | null;

  constructor(
    status: number,
    message: string,
    options?: { retryAfterSeconds?: number | null; remainingCredits?: number | null },
  ) {
    super(message);
    this.name = 'OpenSkyHttpError';
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
    this.remainingCredits = options?.remainingCredits ?? null;
  }
}

function parseNumberHeader(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse an OpenSky HTTP response, handling rate-limit and non-2xx errors.
 */
export async function parseRawResponse(res: Response): Promise<OpenSkyResponse> {
  if (!res.ok) {
    const retryAfterSeconds =
      parseNumberHeader(res.headers.get('x-rate-limit-retry-after-seconds')) ??
      parseNumberHeader(res.headers.get('retry-after'));
    const remainingCredits = parseNumberHeader(res.headers.get('x-rate-limit-remaining'));
    throw new OpenSkyHttpError(res.status, `OpenSky HTTP ${res.status}: ${res.statusText}`, {
      retryAfterSeconds,
      remainingCredits,
    });
  }

  return res.json() as Promise<OpenSkyResponse>;
}

/**
 * Parse an OpenSky state vector array into a Flight object.
 */
export function parseStateVector(
  s: (string | number | boolean | number[] | null)[],
  responseTime: number,
): Flight {
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
    aircraftType: null,
    manufacturer: null,
    registration: null,
    owner: null,
    originCountry: (s[2] as string) ?? '',
  };
}

export function buildStateVectorsUrl(bounds: OpenSkyBoundingBox): string {
  const url = new URL(`${OPENSKY_BASE_URL}/states/all`);
  url.searchParams.set('lamin', String(bounds.lamin));
  url.searchParams.set('lomin', String(bounds.lomin));
  url.searchParams.set('lamax', String(bounds.lamax));
  url.searchParams.set('lomax', String(bounds.lomax));
  return url.toString();
}

export async function parseStateVectorsResponse(res: Response): Promise<Flight[]> {
  const data = await parseRawResponse(res);
  if (!data.states) return [];

  return data.states
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => parseStateVector(s, data.time));
}

/**
 * Fetch state vectors from OpenSky Network within a bounding box.
 * Optionally pass a Bearer token for authenticated requests.
 * Returns raw parsed Flight objects.
 */
export async function fetchStateVectors(
  bounds: OpenSkyBoundingBox,
  token?: string | null,
): Promise<Flight[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(buildStateVectorsUrl(bounds), { headers });
  return parseStateVectorsResponse(res);
}

// --- Arrivals endpoint -------------------------------------------------------

export interface OpenSkyArrival {
  icao24: string;
  callsign: string | null;
  firstSeen: number;
  lastSeen: number;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
}

export interface OpenSkyTrackResponse {
  icao24: string;
  startTime: number;
  endTime: number;
  callsign: string | null;
  path: [number, number | null, number | null, number | null, number | null, boolean][];
}

export function buildArrivalsUrl(airport: string, begin: number, end: number): string {
  const url = new URL(`${OPENSKY_BASE_URL}/flights/arrival`);
  url.searchParams.set('airport', airport);
  url.searchParams.set('begin', String(begin));
  url.searchParams.set('end', String(end));
  return url.toString();
}

export async function parseArrivalsResponse(res: Response): Promise<OpenSkyArrival[]> {
  if (!res.ok) {
    throw new OpenSkyHttpError(res.status, `OpenSky arrivals HTTP ${res.status}: ${res.statusText}`);
  }
  const data: OpenSkyArrival[] = await res.json();
  return data ?? [];
}

/**
 * Fetch historical arrivals at an airport from OpenSky Network.
 * NOTE: OpenSky arrivals are batch-processed — only past data is available.
 * `begin` and `end` are unix timestamps in seconds.
 */
export async function fetchArrivals(
  airport: string,
  begin: number,
  end: number,
  token?: string | null,
): Promise<OpenSkyArrival[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(buildArrivalsUrl(airport, begin, end), { headers });
  return parseArrivalsResponse(res);
}

export function buildTrackUrl(
  endpoint: (typeof OPENSKY_TRACK_ENDPOINTS)[number],
  icao24: string,
  time: number,
): string {
  const url = new URL(`${OPENSKY_BASE_URL}${endpoint}`);
  url.searchParams.set('icao24', icao24.toLowerCase());
  url.searchParams.set('time', String(time));
  return url.toString();
}

export async function parseTrackOkResponse(res: Response): Promise<OpenSkyTrackResponse | null> {
  const data: OpenSkyTrackResponse = await res.json();
  return data ?? null;
}

/**
 * Fetch a historical track for one aircraft near a given time.
 * OpenSky docs have historically shown both `/tracks` and `/tracks/all` examples,
 * so we try the canonical endpoint first and fall back once on 404.
 */
export async function fetchTrack(
  icao24: string,
  time: number,
  token?: string | null,
): Promise<OpenSkyTrackResponse | null> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (let i = 0; i < OPENSKY_TRACK_ENDPOINTS.length; i++) {
    const endpoint = OPENSKY_TRACK_ENDPOINTS[i];
    const res = await fetch(buildTrackUrl(endpoint, icao24, time), { headers });
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

/**
 * Acquire an OAuth2 access token from the OpenSky Network.
 * Returns { access_token, expires_in } or throws on failure.
 */
export async function fetchOpenSkyToken(
  clientId: string,
  clientSecret: string,
): Promise<OpenSkyTokenResponse> {
  const res = await fetch(OPENSKY_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenSky auth failed: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
