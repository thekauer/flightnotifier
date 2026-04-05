import type { Flight } from '@/server/opensky/types';
import type { MetarData } from '@/lib/api/weather';

const ADSBLOL_BASE_URL = 'https://api.adsb.lol';
const AVIATION_WEATHER_BASE_URL = 'https://aviationweather.gov/api/data/metar';
const DEFAULT_RADIUS_NM = 100;
const FETCH_TIMEOUT_MS = 5000;

function trimCallsign(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

interface AdsbLolAircraft {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  true_heading?: number;
}

interface AdsbLolResponse {
  ac?: AdsbLolAircraft[];
}

function parseAltitude(value: number | string | undefined): number {
  if (value === undefined || value === null) return 0;
  if (value === 'ground') return 0;
  return typeof value === 'number' ? value : 0;
}

export async function fetchLiveFlights(latitude: number, longitude: number): Promise<Flight[]> {
  const url = `${ADSBLOL_BASE_URL}/v2/lat/${latitude.toFixed(6)}/lon/${longitude.toFixed(6)}/dist/${DEFAULT_RADIUS_NM}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return [];

    const data = (await response.json()) as AdsbLolResponse;
    const aircraft = data.ac ?? [];

    return aircraft
      .filter((ac) => ac.hex && ac.lat != null && ac.lon != null)
      .map((ac) => {
        const icao24 = (ac.hex ?? '').trim().toLowerCase();
        const callsign = trimCallsign(ac.flight);
        return {
          id: icao24,
          flight: callsign || undefined,
          callsign: callsign || icao24.toUpperCase(),
          lat: ac.lat!,
          lon: ac.lon!,
          alt: ac.alt_geom ?? parseAltitude(ac.alt_baro),
          speed: ac.gs ?? 0,
          track: ac.track ?? ac.true_heading ?? 0,
          verticalRate: ac.geom_rate ?? ac.baro_rate ?? 0,
          onGround: parseAltitude(ac.alt_baro) === 0 && (ac.gs ?? 0) < 40,
          timestamp: Date.now(),
          aircraftType: ac.t ?? null,
          manufacturer: null,
          registration: ac.r ?? null,
          owner: null,
          originCountry: '',
        };
      });
  } catch {
    return [];
  }
}

interface AvWxMetar {
  rawOb?: string;
  name?: string;
  reportTime?: string;
  temp?: number;
  dewp?: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: number | string;
  ceil?: number;
  fltcat?: string;
  altim?: number;
  clouds?: Array<{ cover: string; base: number }>;
}

export async function fetchLiveWeather(station: string): Promise<MetarData | null> {
  const url = `${AVIATION_WEATHER_BASE_URL}?ids=${encodeURIComponent(station)}&format=json`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;

    const data = (await response.json()) as AvWxMetar[];
    const metar = data[0];
    if (!metar) return null;

    const visibility = typeof metar.visib === 'number'
      ? metar.visib
      : metar.visib === '10+'
        ? 10
        : null;

    const fltCat = metar.fltcat;
    const flightCategory =
      fltCat === 'MVFR' || fltCat === 'IFR' || fltCat === 'LIFR'
        ? fltCat
        : 'VFR';

    return {
      raw: metar.rawOb ?? '',
      station,
      observationTime: metar.reportTime ? new Date(metar.reportTime).getTime() : Date.now(),
      temp: metar.temp ?? null,
      dewpoint: metar.dewp ?? null,
      windDirection: metar.wdir ?? null,
      windSpeed: metar.wspd ?? null,
      windGust: metar.wgst ?? null,
      visibility,
      clouds: metar.clouds ?? [],
      ceiling: metar.ceil ?? null,
      qnh: metar.altim ?? null,
      flightCategory,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
