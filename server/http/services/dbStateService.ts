import { inArray, sql } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { flightRoutes } from '@/drizzle/schema/public';
import type { MetarData } from '@/lib/api/weather';
import type { FlightState, ScheduledArrival } from '@/lib/types';
import type { FlightyArrivalRow } from '@/server/arrivals/types';
import {
  estimatedMinutesFromRow,
  flightyDisplayCallsign,
  isCanceledOrDiverted,
} from '@/server/arrivals/flightRow';
import { resolveIcaoFromIata } from '@/lib/airports';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';
import { findAirportByIdent } from '@/lib/server/airportCatalog';
import { callsignMatchesFlighty } from '@/lib/callsignMatch';
import { detectApproachDirection, isBuitenveldertbaanApproach } from '@/server/opensky/detector';
import { buildSchedule } from '@/server/opensky/schedule';
import { predictRunways } from '@/server/runway/predictor';
import { getRunwayHistoryStore } from '@/server/singleton';
import type { Flight } from '@/server/opensky/types';

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;
const DB_STATE_CACHE_TTL_MS = 30_000;
const DB_SCHEDULE_CACHE_TTL_MS = 30_000;
const APPROACH_BOUNDS = {
  south: 52.13,
  west: 4.46,
  north: 52.52,
  east: 5.24,
};

const APPROACH_BOUNDS_OFFSET = {
  south: DEFAULT_AIRPORT.latitude - APPROACH_BOUNDS.south,
  west: DEFAULT_AIRPORT.longitude - APPROACH_BOUNDS.west,
  north: APPROACH_BOUNDS.north - DEFAULT_AIRPORT.latitude,
  east: APPROACH_BOUNDS.east - DEFAULT_AIRPORT.longitude,
};

type AdsbLolSnapshotRow = {
  polled_at: string | Date;
  icao24: string;
  flight: string | null;
  registration: string | null;
  aircraft_type: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude_baro: number | null;
  altitude_geom: number | null;
  ground_speed: number | null;
  track: number | null;
  baro_rate: number | null;
  geom_rate: number | null;
  true_heading: number | null;
  on_ground: boolean | null;
  category: string | null;
  owner: string | null;
  manufacturer: string | null;
  aircraft_icao_type: string | null;
  aircraft_registration: string | null;
};

type OpenSkySnapshotRow = {
  polled_at: string | Date;
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  latitude: number | null;
  longitude: number | null;
  baro_altitude: number | null;
  geo_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  on_ground: boolean | null;
  owner: string | null;
  manufacturer: string | null;
  aircraft_icao_type: string | null;
  registration: string | null;
};

type MetarRow = {
  fetched_at: string | Date;
  raw: string;
  station: string;
  observation_time: string | Date | null;
  temp: number | null;
  dewpoint: number | null;
  wind_direction: number | null;
  wind_speed: number | null;
  wind_gust: number | null;
  visibility: number | null;
  clouds: Array<{ cover: string; base: number }> | null;
  ceiling: number | null;
  qnh: number | null;
  flight_category: string | null;
};

type FlightyRow = {
  scraped_at: string | Date;
  flight_id: string;
  flight?: string | null;
  flight_number: string;
  airline_iata: string | null;
  airline_name: string | null;
  city: string | null;
  status: FlightyArrivalRow['status'] | null;
  original_time: FlightyArrivalRow['originalTime'] | null;
  new_time: FlightyArrivalRow['newTime'] | null;
  departure: FlightyArrivalRow['departure'] | null;
  arrival: FlightyArrivalRow['arrival'] | null;
  secondary_corner: string | null;
};

type FlightRouteRow = {
  callsign: string;
  origin: string | null;
  destination: string | null;
  route: string | null;
};

type PgLikeError = {
  code?: string;
  message?: string;
};

type TimedCacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type TimedPromiseCache<T> = {
  entry: TimedCacheEntry<T> | null;
  promise: Promise<T> | null;
};

const globalForDbStateCache = globalThis as typeof globalThis & {
  __flightNotifierDbStateCache?: Map<string, TimedPromiseCache<FlightState>>;
  __flightNotifierDbScheduleCache?: Map<string, TimedPromiseCache<ScheduledArrival[]>>;
};

function asMs(value: string | Date | null | undefined): number {
  if (!value) return Date.now();
  return new Date(value).getTime();
}

function trimCallsign(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAirportBounds(airportIdent: string) {
  const airport = findAirportByIdent(airportIdent) ?? DEFAULT_AIRPORT;
  return {
    south: airport.latitude - APPROACH_BOUNDS_OFFSET.south,
    west: airport.longitude - APPROACH_BOUNDS_OFFSET.west,
    north: airport.latitude + APPROACH_BOUNDS_OFFSET.north,
    east: airport.longitude + APPROACH_BOUNDS_OFFSET.east,
  };
}

function isFlightWithinBounds(flight: Flight, bounds: { south: number; west: number; north: number; east: number }): boolean {
  return (
    flight.lat >= bounds.south &&
    flight.lat <= bounds.north &&
    flight.lon >= bounds.west &&
    flight.lon <= bounds.east
  );
}

function countryFromFlagPath(flag?: string): string {
  const m = /\/flag\/([A-Za-z]{2})\.svg/i.exec(flag ?? '');
  if (!m) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(m[1]!.toUpperCase()) ?? '';
  } catch {
    return '';
  }
}

function asPgError(error: unknown): PgLikeError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  return error as PgLikeError;
}

function isMissingDbObjectError(error: unknown): boolean {
  const pgError = asPgError(error);
  return pgError?.code === '42P01' || pgError?.code === '42703';
}

function logMissingDbObject(context: string, error: unknown): void {
  const pgError = asPgError(error);
  console.warn(`[db-state] ${context}: ${pgError?.message ?? 'missing database object'}`);
}

function getOrCreateTimedCache<T>(
  existing: TimedPromiseCache<T> | undefined,
): TimedPromiseCache<T> {
  return existing ?? { entry: null, promise: null };
}

async function getCachedValue<T>(
  cache: TimedPromiseCache<T>,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  if (cache.entry && now < cache.entry.expiresAt) {
    return cache.entry.value;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async () => {
    const value = await loader();
    cache.entry = {
      value,
      expiresAt: Date.now() + ttlMs,
    };
    return value;
  })();

  try {
    return await cache.promise;
  } finally {
    cache.promise = null;
  }
}

function getDbStateCache(): TimedPromiseCache<FlightState> {
  const airportIdent = DEFAULT_AIRPORT.ident;
  const cacheMap = globalForDbStateCache.__flightNotifierDbStateCache ?? new Map();
  globalForDbStateCache.__flightNotifierDbStateCache = cacheMap;
  const cache = getOrCreateTimedCache<FlightState>(cacheMap.get(airportIdent));
  cacheMap.set(airportIdent, cache);
  return cache;
}

function getDbStateCacheForAirport(airportIdent: string): TimedPromiseCache<FlightState> {
  const cacheMap = globalForDbStateCache.__flightNotifierDbStateCache ?? new Map();
  globalForDbStateCache.__flightNotifierDbStateCache = cacheMap;
  const cache = getOrCreateTimedCache<FlightState>(cacheMap.get(airportIdent));
  cacheMap.set(airportIdent, cache);
  return cache;
}

function getDbScheduleCache(horizonMinutes: number | null, airportIdent: string): TimedPromiseCache<ScheduledArrival[]> {
  const key = `${airportIdent}:${horizonMinutes === null ? 'all' : String(horizonMinutes)}`;
  const cacheMap = globalForDbStateCache.__flightNotifierDbScheduleCache ?? new Map();
  globalForDbStateCache.__flightNotifierDbScheduleCache = cacheMap;

  const cache = getOrCreateTimedCache<ScheduledArrival[]>(cacheMap.get(key));
  cacheMap.set(key, cache);
  return cache;
}

function normalizeFlightyRows(rows: FlightyRow[]): FlightyArrivalRow[] {
  return rows
    .filter((row) => row.status && row.original_time && row.new_time && row.departure && row.arrival)
    .map((row) => ({
      id: row.flight_id,
      flight: row.flight ?? undefined,
      city: row.city ?? '',
      status: row.status ?? [],
      originalTime: row.original_time!,
      newTime: row.new_time!,
      secondaryCorner: row.secondary_corner ?? undefined,
      airline: {
        id: (row.airline_iata ?? '').toLowerCase(),
        iata: row.airline_iata ?? '',
        name: row.airline_name ?? '',
      },
      flightNumber: row.flight_number,
      departure: row.departure!,
      arrival: row.arrival!,
    }));
}

async function queryLatestAdsbLolSnapshot(): Promise<Flight[]> {
  try {
    const result = await db.execute(sql`
      WITH latest_poll AS (
        SELECT max(polled_at) AS polled_at
        FROM ingest.adsblol_state_vectors
      )
      SELECT
        sv.polled_at,
        sv.icao24,
        sv.flight,
        sv.registration,
        sv.aircraft_type,
        sv.latitude,
        sv.longitude,
        sv.altitude_baro,
        sv.altitude_geom,
        sv.ground_speed,
        sv.track,
        sv.baro_rate,
        sv.geom_rate,
        sv.true_heading,
        (coalesce(sv.altitude_baro, 0) = 0 AND coalesce(sv.ground_speed, 0) < 40) AS on_ground,
        sv.category,
        a.owner,
        a.manufacturer,
        a.icao_type AS aircraft_icao_type,
        a.registration AS aircraft_registration
      FROM ingest.adsblol_state_vectors sv
      JOIN latest_poll lp ON sv.polled_at = lp.polled_at
      LEFT JOIN public.aircraft a ON a.icao24 = sv.icao24
      WHERE sv.latitude IS NOT NULL
        AND sv.longitude IS NOT NULL
    `);

    const rows = result.rows as AdsbLolSnapshotRow[];
    return rows.map((row) => ({
      id: row.icao24.toLowerCase(),
      flight: trimCallsign(row.flight) || undefined,
      callsign: trimCallsign(row.flight) || row.icao24.toUpperCase(),
      lat: row.latitude ?? 0,
      lon: row.longitude ?? 0,
      alt: row.altitude_geom ?? row.altitude_baro ?? 0,
      speed: row.ground_speed ?? 0,
      track: row.track ?? row.true_heading ?? 0,
      verticalRate: row.geom_rate ?? row.baro_rate ?? 0,
      onGround: row.on_ground ?? false,
      timestamp: asMs(row.polled_at),
      aircraftType: row.aircraft_type ?? row.aircraft_icao_type ?? null,
      manufacturer: row.manufacturer ?? null,
      registration: row.registration ?? row.aircraft_registration ?? null,
      owner: row.owner ?? null,
      originCountry: '',
    }));
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('adsblol snapshot unavailable', error);
      return [];
    }
    throw error;
  }
}

async function queryLatestOpenSkySnapshot(): Promise<Flight[]> {
  try {
    const result = await db.execute(sql`
      WITH latest_poll AS (
        SELECT max(polled_at) AS polled_at
        FROM ingest.opensky_state_vectors
      )
      SELECT
        sv.polled_at,
        sv.icao24,
        sv.callsign,
        sv.origin_country,
        sv.latitude,
        sv.longitude,
        sv.baro_altitude,
        sv.geo_altitude,
        sv.velocity,
        sv.true_track,
        sv.vertical_rate,
        sv.on_ground,
        a.owner,
        a.manufacturer,
        a.icao_type AS aircraft_icao_type,
        a.registration
      FROM ingest.opensky_state_vectors sv
      JOIN latest_poll lp ON sv.polled_at = lp.polled_at
      LEFT JOIN public.aircraft a ON a.icao24 = sv.icao24
      WHERE sv.latitude IS NOT NULL
        AND sv.longitude IS NOT NULL
    `);

    const rows = result.rows as OpenSkySnapshotRow[];
    return rows.map((row) => ({
      id: row.icao24.toLowerCase(),
      flight: trimCallsign(row.callsign) || undefined,
      callsign: trimCallsign(row.callsign) || row.icao24.toUpperCase(),
      lat: row.latitude ?? 0,
      lon: row.longitude ?? 0,
      alt: Math.round((row.geo_altitude ?? row.baro_altitude ?? 0) * 3.28084),
      speed: Math.round((row.velocity ?? 0) * 1.94384),
      track: row.true_track ?? 0,
      verticalRate: Math.round((row.vertical_rate ?? 0) * 196.850394),
      onGround: row.on_ground ?? false,
      timestamp: asMs(row.polled_at),
      aircraftType: row.aircraft_icao_type ?? null,
      manufacturer: row.manufacturer ?? null,
      registration: row.registration ?? null,
      owner: row.owner ?? null,
      originCountry: row.origin_country ?? '',
    }));
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('opensky snapshot unavailable', error);
      return [];
    }
    throw error;
  }
}

export async function getLatestDbFlights(airportIdent: string = DEFAULT_AIRPORT.ident): Promise<Flight[]> {
  const adsbLolFlights = await queryLatestAdsbLolSnapshot();
  const bounds = getAirportBounds(airportIdent);
  return adsbLolFlights.filter(
    (flight) => isFlightWithinBounds(flight, bounds),
  );
}

export async function getLatestDbWeather(station: string): Promise<MetarData | null> {
  let result;
  try {
    result = await db.execute(sql`
      SELECT
        fetched_at,
        raw,
        station,
        observation_time,
        temp,
        dewpoint,
        wind_direction,
        wind_speed,
        wind_gust,
        visibility,
        clouds,
        ceiling,
        qnh,
        flight_category
      FROM ingest.metar
      WHERE station = ${station}
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1
    `);
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('metar table unavailable', error);
      return null;
    }
    throw error;
  }

  const row = (result.rows as MetarRow[])[0];
  if (!row) {
    return null;
  }

  return {
    raw: row.raw,
    station: row.station,
    observationTime: row.observation_time ? asMs(row.observation_time) : asMs(row.fetched_at),
    temp: row.temp,
    dewpoint: row.dewpoint,
    windDirection: row.wind_direction,
    windSpeed: row.wind_speed,
    windGust: row.wind_gust,
    visibility: row.visibility,
    clouds: row.clouds ?? [],
    ceiling: row.ceiling,
    qnh: row.qnh,
    flightCategory:
      row.flight_category === 'MVFR' ||
      row.flight_category === 'IFR' ||
      row.flight_category === 'LIFR'
        ? row.flight_category
        : 'VFR',
    fetchedAt: asMs(row.fetched_at),
  };
}

export async function getLatestDbFlightyArrivals(): Promise<FlightyArrivalRow[]> {
  try {
    const result = await db.execute(sql`
      WITH latest_scrape AS (
        SELECT max(scraped_at) AS scraped_at
        FROM ingest.flighty_arrivals
      )
      SELECT
        fa.scraped_at,
        fa.flight_id,
        fa.flight_number,
        fa.airline_iata,
        fa.airline_name,
        fa.city,
        fa.status,
        fa.original_time,
        fa.new_time,
        fa.departure,
        fa.arrival,
        fa.secondary_corner
      FROM ingest.flighty_arrivals fa
      JOIN latest_scrape ls ON fa.scraped_at = ls.scraped_at
    `);

    return normalizeFlightyRows(result.rows as FlightyRow[]);
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('flighty arrivals unavailable', error);
      return [];
    }
    throw error;
  }
}

async function getDbRouteMap(callsigns: string[]): Promise<Map<string, FlightRouteRow>> {
  const normalized = Array.from(
    new Set(
      callsigns
        .map((callsign) => callsign.replace(/\s+/g, '').toUpperCase().trim())
        .filter(Boolean),
    ),
  );
  if (normalized.length === 0) {
    return new Map();
  }

  const result = await db
    .select({
      callsign: flightRoutes.callsign,
      origin: flightRoutes.origin,
      destination: flightRoutes.destination,
      route: flightRoutes.route,
    })
    .from(flightRoutes)
    .where(inArray(flightRoutes.callsign, normalized))
    .catch((error) => {
      if (isMissingDbObjectError(error)) {
        logMissingDbObject('flight_routes unavailable', error);
        return [];
      }
      throw error;
    });

  const map = new Map<string, FlightRouteRow>();
  for (const row of result as FlightRouteRow[]) {
    map.set(row.callsign, row);
  }
  return map;
}

export async function enrichFlightsFromDb(flights: Flight[]): Promise<Flight[]> {
  const [rows, routeMap] = await Promise.all([
    getLatestDbFlightyArrivals(),
    getDbRouteMap(flights.map((flight) => flight.callsign)),
  ]);

  for (const flight of flights) {
    if (!flight.callsign) {
      continue;
    }

    const normalizedCallsign = flight.callsign.replace(/\s+/g, '').toUpperCase();
    const routeInfo = routeMap.get(normalizedCallsign);
    if (routeInfo) {
      flight.origin = routeInfo.origin ?? flight.origin;
      flight.destination = routeInfo.destination ?? flight.destination;
      flight.route = routeInfo.route ?? flight.route;
    }

    if (flight.origin && flight.destination) {
      continue;
    }

    const match = rows.find((row) =>
      callsignMatchesFlighty(flight.flight ?? flight.callsign, row.airline.iata, row.flightNumber, row.flight),
    );
    if (!match) {
      continue;
    }

    const depIata = match.departure.iata?.toUpperCase();
    const originIcao = depIata ? resolveIcaoFromIata(depIata) : undefined;

    flight.origin = originIcao;
    flight.destination = flight.destination ?? 'EHAM';
    flight.route = flight.route ?? (depIata ? `${depIata} → AMS` : undefined);
    if (!flight.originCountry) {
      flight.originCountry = countryFromFlagPath(match.departure.flag) || '';
    }
  }

  return flights;
}

async function loadDbState(airportIdent: string): Promise<FlightState> {
  const weatherStation = airportIdent.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  const [rawFlights, weather] = await Promise.all([
    getLatestDbFlights(weatherStation),
    getLatestDbWeather(weatherStation),
  ]);

  const allFlights = await enrichFlightsFromDb(rawFlights);
  const approachingFlights = allFlights.filter(isBuitenveldertbaanApproach);
  const recentApproachDirections = approachingFlights
    .map((flight) => {
      const runway = detectApproachDirection(flight);
      return runway ? { timestamp: flight.timestamp, runway } : null;
    })
    .filter((value): value is { timestamp: number; runway: '09' | '27' } => value !== null);

  const runwayPredictions = predictRunways(
    allFlights,
    weather,
    getRunwayHistoryStore(),
    recentApproachDirections,
  );

  const latestTimestamp =
    allFlights.reduce((max, flight) => Math.max(max, flight.timestamp), 0) || Date.now();

  return {
    focusAirportIdent: weatherStation,
    allFlights,
    approachingFlights,
    buitenveldertbaanActive: approachingFlights.length > 0,
    lastUpdateMs: latestTimestamp,
    weather,
    runwayPredictions,
  };
}

function filterFlightsForAirport(allFlights: Flight[], airportIdent: string): Flight[] {
  const bounds = getAirportBounds(airportIdent);
  return allFlights.filter(
    (flight) =>
      flight.origin === airportIdent ||
      flight.destination === airportIdent ||
      isFlightWithinBounds(flight, bounds),
  );
}

function scopeStateToAirport(baseState: FlightState, airportIdent: string): FlightState {
  const allFlights = filterFlightsForAirport(baseState.allFlights, airportIdent);
  const approachingFlights = allFlights.filter(
    (flight) =>
      !flight.onGround &&
      (flight.destination === airportIdent || (airportIdent === DEFAULT_AIRPORT.ident && isBuitenveldertbaanApproach(flight))),
  );

  return {
    ...baseState,
    focusAirportIdent: airportIdent,
    allFlights,
    approachingFlights,
    buitenveldertbaanActive: approachingFlights.length > 0,
    runwayPredictions: [],
  };
}

export async function getDbState(airportIdent: string = DEFAULT_AIRPORT.ident): Promise<FlightState> {
  const normalizedAirportIdent = airportIdent.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  if (normalizedAirportIdent === DEFAULT_AIRPORT.ident) {
    return getCachedValue(getDbStateCache(), DB_STATE_CACHE_TTL_MS, () => loadDbState(normalizedAirportIdent));
  }

  return getCachedValue(
    getDbStateCacheForAirport(normalizedAirportIdent),
    DB_STATE_CACHE_TTL_MS,
    async () => scopeStateToAirport(await loadDbState(normalizedAirportIdent), normalizedAirportIdent),
  );
}

function findLiveFlight(
  rows: Flight[],
  airlineIata: string,
  flightNum: string,
  flight?: string,
): Flight | undefined {
  return rows.find((liveFlight) =>
    (liveFlight.flight ?? liveFlight.callsign) &&
    callsignMatchesFlighty(
      liveFlight.flight ?? liveFlight.callsign,
      airlineIata,
      flightNum,
      flight,
    ),
  );
}

function rowToScheduledArrival(
  row: FlightyArrivalRow,
  nowMs: number,
  approachingIds: Set<string>,
  allFlights: Flight[],
): ScheduledArrival | null {
  if (isCanceledOrDiverted(row)) return null;

  const etaMin = estimatedMinutesFromRow(row, nowMs);
  if (etaMin === null) return null;

  const live = findLiveFlight(allFlights, row.airline.iata, row.flightNumber, row.flight);
  const id = live?.id ?? `flighty:${row.id}`;
  const depIata = row.departure.iata?.toUpperCase() ?? '';
  const originIcao = resolveIcaoFromIata(depIata);
  const originCountry = live?.originCountry || countryFromFlagPath(row.departure.flag) || '';
  const distKm = live ? haversineKm(live.lat, live.lon, SCHIPHOL_LAT, SCHIPHOL_LON) : 0;

  return {
    id,
    callsign: live?.flight?.trim() || live?.callsign?.trim() || flightyDisplayCallsign(row),
    aircraftType: live?.aircraftType ?? null,
    manufacturer: live?.manufacturer ?? null,
    registration: live?.registration ?? null,
    owner: live?.owner ?? null,
    originCountry,
    origin: live?.origin ?? originIcao,
    destination: live?.destination ?? 'EHAM',
    route: live?.route ?? (depIata ? `${depIata} → AMS` : undefined),
    altitude: live?.alt ?? 0,
    speed: live?.speed ?? 0,
    verticalRate: live?.verticalRate ?? 0,
    distanceToAmsKm: live ? Math.round(distKm) : 0,
    estimatedMinutes: etaMin,
    etaTimestampMs: nowMs + etaMin * 60_000,
    isBuitenveldertbaan: id !== `flighty:${row.id}` && approachingIds.has(id),
  };
}

async function loadDbSchedule(horizonMinutes: number | null, airportIdent: string): Promise<ScheduledArrival[]> {
  const normalizedAirportIdent = airportIdent.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  const state = await getDbState(normalizedAirportIdent);
  const approachingIds = new Set(state.approachingFlights.map((flight) => flight.id));
  const rows = normalizedAirportIdent === DEFAULT_AIRPORT.ident ? await getLatestDbFlightyArrivals() : [];
  const airport = findAirportByIdent(normalizedAirportIdent) ?? DEFAULT_AIRPORT;

  let schedule =
    rows.length > 0
      ? rows
          .map((row) => rowToScheduledArrival(row, state.lastUpdateMs, approachingIds, state.allFlights))
          .filter((row): row is ScheduledArrival => row !== null)
          .filter((row) => row.destination === normalizedAirportIdent)
          .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes)
      : buildSchedule(state.allFlights, approachingIds, airport);

  if (schedule.length === 0) {
    schedule = buildSchedule(state.allFlights, approachingIds, airport);
  }

  if (horizonMinutes !== null && !isNaN(horizonMinutes) && horizonMinutes > 0) {
    const clamped = Math.min(Math.max(horizonMinutes, 1), 1440);
    schedule = schedule.filter((arrival) => arrival.estimatedMinutes <= clamped);
  }

  return schedule;
}

export async function getDbSchedule(
  horizonMinutes: number | null,
  airportIdent: string = DEFAULT_AIRPORT.ident,
): Promise<ScheduledArrival[]> {
  const normalizedAirportIdent = airportIdent.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  return getCachedValue(
    getDbScheduleCache(horizonMinutes, normalizedAirportIdent),
    DB_SCHEDULE_CACHE_TTL_MS,
    () => loadDbSchedule(horizonMinutes, normalizedAirportIdent),
  );
}
