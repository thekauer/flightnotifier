/**
 * Aviation Weather API client — fetches METAR data from aviationweather.gov.
 * Works both server-side (poller) and client-side (fallback mode).
 */

// --- Types -------------------------------------------------------------------

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface CloudLayer {
  cover: string;   // SKC, FEW, SCT, BKN, OVC
  base: number;    // feet AGL
}

export interface MetarData {
  raw: string;
  station: string;
  observationTime: number;       // unix ms
  temp: number | null;           // celsius
  dewpoint: number | null;       // celsius
  windDirection: number | null;  // degrees
  windSpeed: number | null;      // knots
  windGust: number | null;       // knots
  visibility: number | null;     // statute miles
  clouds: CloudLayer[];
  ceiling: number | null;        // feet AGL (lowest BKN/OVC layer), null = no ceiling
  qnh: number | null;            // hPa / mb
  flightCategory: FlightCategory;
  fetchedAt: number;             // unix ms — when we fetched it
}

// --- Raw API response shape --------------------------------------------------

interface AvWxCloud {
  cover: string;
  base: number;
}

interface AvWxMetarResponse {
  icaoId: string;
  rawOb: string;
  obsTime: number;         // unix seconds
  temp: number | null;
  dewp: number | null;
  wdir: number | string | null;
  wspd: number | null;
  wgst: number | null;
  visib: number | string | null;
  clouds: AvWxCloud[];
  altim: number | null;    // hPa
  fltCat: string;
}

// --- Parsing -----------------------------------------------------------------

function parseCeiling(clouds: CloudLayer[]): number | null {
  for (const layer of clouds) {
    if (layer.cover === 'BKN' || layer.cover === 'OVC') {
      return layer.base;
    }
  }
  return null;
}

function parseVisibility(raw: number | string | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  // "6+" means 6+ statute miles
  const cleaned = String(raw).replace('+', '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parseWindDirection(raw: number | string | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  if (raw === 'VRB') return null;
  const parsed = parseInt(String(raw), 10);
  return isNaN(parsed) ? null : parsed;
}

function toFlightCategory(raw: string): FlightCategory {
  const upper = raw.toUpperCase();
  if (upper === 'MVFR') return 'MVFR';
  if (upper === 'IFR') return 'IFR';
  if (upper === 'LIFR') return 'LIFR';
  return 'VFR';
}

function parseMetarResponse(item: AvWxMetarResponse): MetarData {
  const clouds: CloudLayer[] = (item.clouds ?? []).map((c) => ({
    cover: c.cover,
    base: c.base,
  }));

  return {
    raw: item.rawOb,
    station: item.icaoId,
    observationTime: item.obsTime * 1000,
    temp: item.temp,
    dewpoint: item.dewp,
    windDirection: parseWindDirection(item.wdir),
    windSpeed: item.wspd,
    windGust: item.wgst ?? null,
    visibility: parseVisibility(item.visib),
    clouds,
    ceiling: parseCeiling(clouds),
    qnh: item.altim ?? null,
    flightCategory: toFlightCategory(item.fltCat ?? 'VFR'),
    fetchedAt: Date.now(),
  };
}

// --- Public API --------------------------------------------------------------

const METAR_URL = 'https://aviationweather.gov/api/data/metar';

/**
 * Fetch the latest METAR for a station (e.g. "EHAM").
 * Usable both server-side and client-side.
 */
export async function fetchMetar(station: string): Promise<MetarData> {
  const url = `${METAR_URL}?ids=${encodeURIComponent(station)}&format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`METAR fetch failed: HTTP ${res.status}`);
  }
  const data: AvWxMetarResponse[] = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`No METAR data returned for ${station}`);
  }
  return parseMetarResponse(data[0]);
}

// --- Visibility helpers (used by components) ---------------------------------

export type VisibilityLevel = 'clear' | 'partial' | 'obscured';

/**
 * Determine ground-visibility level for an aircraft at the given altitude (feet).
 *
 * Logic:
 * - If ceiling exists and is below the aircraft altitude -> aircraft is above clouds
 * - If visibility < 5 SM -> low visibility conditions
 * - Clouds block line-of-sight; darkness does NOT (lights are visible at night)
 */
export function getVisibilityLevel(
  altitudeFt: number,
  weather: MetarData | null,
): VisibilityLevel {
  if (!weather) return 'clear';

  const { ceiling, visibility } = weather;

  // Aircraft above a ceiling layer -> likely not visible from ground
  if (ceiling !== null && altitudeFt > ceiling) {
    return 'obscured';
  }

  // Below ceiling (or no ceiling) but poor surface visibility
  if (visibility !== null && visibility < 5) return 'partial';

  return 'clear';
}

/**
 * Human-readable label for a visibility level.
 */
export function getVisibilityLabel(level: VisibilityLevel): string {
  switch (level) {
    case 'clear':
      return 'Visible';
    case 'partial':
      return 'Low vis';
    case 'obscured':
      return 'Above clouds';
  }
}
