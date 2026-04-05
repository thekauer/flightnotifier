import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { runways } from '@/drizzle/schema/public';
import type {
  AirportMovementConfidence,
  AirportMovementFilter,
  AirportMovementsPayload,
  AirportMovementTrack,
  AirportMovementTrackPoint,
  AirportMovementType,
  AirportMovementWeather,
} from '@/lib/airportMovements';
import { findAirportByIdent } from '@/lib/server/airportCatalog';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

const DEFAULT_TIME_ZONE = 'UTC';
const FOOTPRINT_PADDING_KM = 3;
const APPROACH_PADDING_KM = 32;
const MIN_POINT_COUNT = 3;
const RUNWAY_INFERENCE_WINDOW_POINTS = 18;
const ARRIVAL_ALONG_MIN_KM = -14;
const ARRIVAL_ALONG_MAX_KM = 5;
const DEPARTURE_ALONG_MIN_KM = -2;
const DEPARTURE_ALONG_MAX_KM = 14;
const MIN_FLIGHT_ALTITUDE_FEET = 1200;
const MIN_FLIGHT_SPEED_KNOTS = 140;
const MAX_REASONABLE_RUNWAY_SCORE = 10;
const MIN_RUNWAY_SEGMENT_ALTITUDE_FEET = 150;
const MIN_RUNWAY_SEGMENT_SPEED_KNOTS = 70;
const HIGH_CONFIDENCE_RUNWAY_SCORE = 4.5;
const MEDIUM_CONFIDENCE_RUNWAY_SCORE = 7;

type AggregatedTrackRow = {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  first_seen: string | Date;
  last_seen: string | Date;
  point_count: number;
  path:
    | Array<[number, number, number, number | null, number | null, number | null]>
    | null;
};

type RunwayGeometry = {
  leIdent: string;
  heIdent: string;
  le: [number, number];
  he: [number, number];
};

type RunwayDirectionCandidate = {
  runway: string;
  threshold: [number, number];
  heading: number;
};

type AirportBounds = {
  footprint: { south: number; west: number; north: number; east: number };
  approach: { south: number; west: number; north: number; east: number };
};

type MetarRow = {
  fetched_at: string | Date;
  raw: string;
  station: string;
  observation_time: string | Date | null;
  wind_direction: number | null;
  wind_speed: number | null;
  wind_gust: number | null;
  visibility: number | null;
  ceiling: number | null;
  flight_category: 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null;
};

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidAirportIdent(value: string): boolean {
  return /^[A-Z0-9]{3,4}$/.test(value);
}

function isValidMovementFilter(value: string): value is AirportMovementFilter {
  return value === 'all' || value === 'arrival' || value === 'departure' || value === 'unknown';
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getDefaultDate(timeZone: string): string {
  return formatDateInTimeZone(new Date(Date.now() - 24 * 60 * 60 * 1000), timeZone);
}

function utcMsForWallClock(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number | null {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const start = Date.UTC(year, month - 1, day - 1, 12, 0, 0, 0);
  const end = Date.UTC(year, month - 1, day + 1, 12, 0, 0, 0);

  for (let t = start; t < end; t += 60_000) {
    const parts = formatter.formatToParts(new Date(t));
    const y2 = Number(parts.find((part) => part.type === 'year')?.value);
    const m2 = Number(parts.find((part) => part.type === 'month')?.value);
    const d2 = Number(parts.find((part) => part.type === 'day')?.value);
    const h2 = Number(parts.find((part) => part.type === 'hour')?.value);
    const min2 = Number(parts.find((part) => part.type === 'minute')?.value);

    if (y2 === year && m2 === month && d2 === day && h2 === hour && min2 === minute) {
      return t;
    }
  }

  return null;
}

function getTimeZoneDayRange(date: string, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = date.split('-').map(Number);
  const startMs = utcMsForWallClock(timeZone, year!, month!, day!, 0, 0);

  const nextDay = new Date(Date.UTC(year!, month! - 1, day! + 1, 12, 0, 0, 0));
  const nextDate = formatDateInTimeZone(nextDay, timeZone);
  const [nextYear, nextMonth, nextDayOfMonth] = nextDate.split('-').map(Number);
  const endMs = utcMsForWallClock(timeZone, nextYear!, nextMonth!, nextDayOfMonth!, 0, 0);

  if (startMs == null || endMs == null) {
    throw new Error(`Unable to resolve ${timeZone} day range for ${date}`);
  }

  return {
    start: new Date(startMs),
    end: new Date(endMs),
  };
}

function kmToLatDegrees(km: number): number {
  return km / 111.32;
}

function kmToLonDegrees(km: number, latitude: number): number {
  return km / (111.32 * Math.cos((latitude * Math.PI) / 180));
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(from: [number, number], to: [number, number]): number {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const deltaLon = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function headingDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function localOffsetKm(origin: [number, number], point: [number, number]): { east: number; north: number } {
  const midLat = (origin[0] + point[0]) / 2;
  return {
    east: (point[1] - origin[1]) * 111.32 * Math.cos((midLat * Math.PI) / 180),
    north: (point[0] - origin[0]) * 111.32,
  };
}

function projectOntoHeadingKm(
  origin: [number, number],
  point: [number, number],
  heading: number,
): { along: number; cross: number } {
  const { east, north } = localOffsetKm(origin, point);
  const radians = (heading * Math.PI) / 180;
  const along = east * Math.sin(radians) + north * Math.cos(radians);
  const cross = east * Math.cos(radians) - north * Math.sin(radians);
  return { along, cross };
}

function zonePenaltyKm(value: number, min: number, max: number): number {
  if (value < min) {
    return min - value;
  }
  if (value > max) {
    return value - max;
  }
  return 0;
}

function normalizeTrackPoint(
  value: [number, number, number, number | null, number | null, number | null],
): AirportMovementTrackPoint {
  return {
    time: value[0],
    lat: value[1],
    lon: value[2],
    altitude: value[3],
    heading: value[4],
    speed: value[5],
  };
}

function runwayDirectionCandidates(
  movement: AirportMovementType,
  runway: RunwayGeometry,
): RunwayDirectionCandidate[] {
  return movement === 'arrival'
    ? [
        {
          runway: runway.leIdent,
          threshold: runway.le,
          heading: bearingDegrees(runway.le, runway.he),
        },
        {
          runway: runway.heIdent,
          threshold: runway.he,
          heading: bearingDegrees(runway.he, runway.le),
        },
      ]
    : [
        {
          runway: runway.leIdent,
          threshold: runway.le,
          heading: bearingDegrees(runway.le, runway.he),
        },
        {
          runway: runway.heIdent,
          threshold: runway.he,
          heading: bearingDegrees(runway.he, runway.le),
        },
      ];
}

function inferHeadingBetweenPoints(from: AirportMovementTrackPoint, to: AirportMovementTrackPoint): number {
  return to.heading ?? from.heading ?? bearingDegrees([from.lat, from.lon], [to.lat, to.lon]);
}

function runwayInferenceWindow(
  movement: AirportMovementType,
  path: AirportMovementTrackPoint[],
): AirportMovementTrackPoint[] {
  if (path.length <= RUNWAY_INFERENCE_WINDOW_POINTS) {
    return path;
  }

  const meaningfulIndex =
    movement === 'arrival'
      ? path.findLastIndex(
          (point) =>
            (point.altitude != null && point.altitude >= MIN_RUNWAY_SEGMENT_ALTITUDE_FEET) ||
            (point.speed != null && point.speed >= MIN_RUNWAY_SEGMENT_SPEED_KNOTS),
        )
      : path.findIndex(
          (point) =>
            (point.altitude != null && point.altitude >= MIN_RUNWAY_SEGMENT_ALTITUDE_FEET) ||
            (point.speed != null && point.speed >= MIN_RUNWAY_SEGMENT_SPEED_KNOTS),
        );

  if (meaningfulIndex >= 0) {
    if (movement === 'arrival') {
      const end = meaningfulIndex + 1;
      return path.slice(Math.max(0, end - RUNWAY_INFERENCE_WINDOW_POINTS), end);
    }

    const start = meaningfulIndex;
    return path.slice(start, Math.min(path.length, start + RUNWAY_INFERENCE_WINDOW_POINTS));
  }

  return movement === 'arrival'
    ? path.slice(-RUNWAY_INFERENCE_WINDOW_POINTS)
    : path.slice(0, RUNWAY_INFERENCE_WINDOW_POINTS);
}

function inBounds(point: AirportMovementTrackPoint, bounds: AirportBounds['footprint']): boolean {
  return (
    point.lat >= bounds.south &&
    point.lat <= bounds.north &&
    point.lon >= bounds.west &&
    point.lon <= bounds.east
  );
}

async function loadRunwayGeometry(airportIdent: string): Promise<RunwayGeometry[]> {
  const rows = await db
    .select({
      leIdent: runways.leIdent,
      heIdent: runways.heIdent,
      leLatitudeDeg: runways.leLatitudeDeg,
      leLongitudeDeg: runways.leLongitudeDeg,
      heLatitudeDeg: runways.heLatitudeDeg,
      heLongitudeDeg: runways.heLongitudeDeg,
    })
    .from(runways)
    .where(eq(runways.airportIdent, airportIdent));

  return rows
    .filter(
      (row) =>
        row.leIdent &&
        row.heIdent &&
        row.leLatitudeDeg != null &&
        row.leLongitudeDeg != null &&
        row.heLatitudeDeg != null &&
        row.heLongitudeDeg != null,
    )
    .map((row) => ({
      leIdent: row.leIdent!,
      heIdent: row.heIdent!,
      le: [row.leLatitudeDeg!, row.leLongitudeDeg!] as [number, number],
      he: [row.heLatitudeDeg!, row.heLongitudeDeg!] as [number, number],
    }));
}

function buildAirportBounds(
  airportLatitude: number,
  airportLongitude: number,
  runwayGeometry: RunwayGeometry[],
): AirportBounds {
  const points =
    runwayGeometry.length > 0
      ? runwayGeometry.flatMap((runway) => [runway.le, runway.he])
      : ([[airportLatitude, airportLongitude]] as [number, number][]);

  const minLat = Math.min(...points.map((point) => point[0]));
  const maxLat = Math.max(...points.map((point) => point[0]));
  const minLon = Math.min(...points.map((point) => point[1]));
  const maxLon = Math.max(...points.map((point) => point[1]));
  const midLat = (minLat + maxLat) / 2;

  const footprintLatPadding = kmToLatDegrees(FOOTPRINT_PADDING_KM);
  const footprintLonPadding = kmToLonDegrees(FOOTPRINT_PADDING_KM, midLat);
  const approachLatPadding = kmToLatDegrees(APPROACH_PADDING_KM);
  const approachLonPadding = kmToLonDegrees(APPROACH_PADDING_KM, midLat);

  return {
    footprint: {
      south: minLat - footprintLatPadding,
      north: maxLat + footprintLatPadding,
      west: minLon - footprintLonPadding,
      east: maxLon + footprintLonPadding,
    },
    approach: {
      south: minLat - approachLatPadding,
      north: maxLat + approachLatPadding,
      west: minLon - approachLonPadding,
      east: maxLon + approachLonPadding,
    },
  };
}

function classifyMovement(args: {
  origin: string | null;
  destination: string | null;
  airportIdent: string;
  startsNearAirport: boolean;
  endsNearAirport: boolean;
  altitudeStart: number | null;
  altitudeEnd: number | null;
  maxAltitude: number | null;
  maxSpeed: number | null;
}): {
  movement: AirportMovementType;
  confidence: AirportMovementConfidence;
  reason: string;
  altitudeDelta: number | null;
} {
  const {
    origin,
    destination,
    airportIdent,
    startsNearAirport,
    endsNearAirport,
    altitudeStart,
    altitudeEnd,
    maxAltitude,
    maxSpeed,
  } = args;
  const altitudeDelta =
    altitudeStart != null && altitudeEnd != null ? altitudeEnd - altitudeStart : null;
  const likelyFlight =
    (maxAltitude != null && maxAltitude >= MIN_FLIGHT_ALTITUDE_FEET) ||
    (maxSpeed != null && maxSpeed >= MIN_FLIGHT_SPEED_KNOTS);

  if (destination === airportIdent && origin !== airportIdent) {
    return { movement: 'arrival', confidence: 'high', reason: 'destination_matches_airport', altitudeDelta };
  }

  if (origin === airportIdent && destination !== airportIdent) {
    return { movement: 'departure', confidence: 'high', reason: 'origin_matches_airport', altitudeDelta };
  }

  if (destination != null && destination !== airportIdent && endsNearAirport && !startsNearAirport) {
    return { movement: 'unknown', confidence: 'low', reason: 'destination_other_airport', altitudeDelta };
  }

  if (origin != null && origin !== airportIdent && startsNearAirport && !endsNearAirport) {
    return { movement: 'unknown', confidence: 'low', reason: 'origin_other_airport', altitudeDelta };
  }

  if (startsNearAirport && endsNearAirport && !likelyFlight) {
    return { movement: 'unknown', confidence: 'low', reason: 'stays_near_airport_surface', altitudeDelta };
  }

  if (!startsNearAirport && endsNearAirport && likelyFlight) {
    return { movement: 'arrival', confidence: 'medium', reason: 'approaches_airport', altitudeDelta };
  }

  if (startsNearAirport && !endsNearAirport && likelyFlight) {
    return { movement: 'departure', confidence: 'medium', reason: 'departs_airport', altitudeDelta };
  }

  if (endsNearAirport && altitudeDelta != null && altitudeDelta <= -500) {
    return { movement: 'arrival', confidence: 'medium', reason: 'ends_near_airport_descending', altitudeDelta };
  }

  if (startsNearAirport && altitudeDelta != null && altitudeDelta >= 500) {
    return { movement: 'departure', confidence: 'medium', reason: 'starts_near_airport_climbing', altitudeDelta };
  }

  if (endsNearAirport) {
    return { movement: 'arrival', confidence: 'low', reason: 'ends_near_airport', altitudeDelta };
  }

  if (startsNearAirport) {
    return { movement: 'departure', confidence: 'low', reason: 'starts_near_airport', altitudeDelta };
  }

  return { movement: 'unknown', confidence: 'low', reason: 'insufficient_signal', altitudeDelta };
}

function inferRunway(
  movement: AirportMovementType,
  path: AirportMovementTrackPoint[],
  runwayGeometry: RunwayGeometry[],
): { runway: string | null; confidence: AirportMovementConfidence } {
  if (runwayGeometry.length === 0 || path.length < 2 || movement === 'unknown') {
    return { runway: null, confidence: 'low' };
  }

  const focusPath = runwayInferenceWindow(movement, path);

  let best: { runway: string; score: number } | null = null;

  for (const runway of runwayGeometry) {
    for (const candidate of runwayDirectionCandidates(movement, runway)) {
      for (let index = 0; index < focusPath.length - 1; index += 1) {
        const from = focusPath[index]!;
        const to = focusPath[index + 1]!;
        const segmentHeading = inferHeadingBetweenPoints(from, to);
        const headingPenalty = headingDifference(segmentHeading, candidate.heading) / 12;

        const fromProjection = projectOntoHeadingKm(
          candidate.threshold,
          [from.lat, from.lon],
          candidate.heading,
        );
        const toProjection = projectOntoHeadingKm(candidate.threshold, [to.lat, to.lon], candidate.heading);
        const alongMid = (fromProjection.along + toProjection.along) / 2;
        const crossTrackKm = (Math.abs(fromProjection.cross) + Math.abs(toProjection.cross)) / 2;
        const thresholdDistanceKm = Math.min(
          haversineKm(from.lat, from.lon, candidate.threshold[0], candidate.threshold[1]),
          haversineKm(to.lat, to.lon, candidate.threshold[0], candidate.threshold[1]),
        );
        const progressKm = toProjection.along - fromProjection.along;
        const zonePenalty =
          movement === 'arrival'
            ? zonePenaltyKm(alongMid, ARRIVAL_ALONG_MIN_KM, ARRIVAL_ALONG_MAX_KM)
            : zonePenaltyKm(alongMid, DEPARTURE_ALONG_MIN_KM, DEPARTURE_ALONG_MAX_KM);
        const progressPenalty =
          progressKm >= -0.15 ? 0 : movement === 'arrival' ? 6 : 8;
        const score =
          crossTrackKm * 5 +
          headingPenalty +
          thresholdDistanceKm * 0.35 +
          zonePenalty * 0.8 +
          progressPenalty;

        if (!best || score < best.score) {
          best = { runway: candidate.runway, score };
        }
      }
    }
  }

  if (!best || best.score > MAX_REASONABLE_RUNWAY_SCORE) {
    return { runway: null, confidence: 'low' };
  }

  if (best.score <= HIGH_CONFIDENCE_RUNWAY_SCORE) {
    return { runway: best.runway, confidence: 'high' };
  }

  if (best.score <= MEDIUM_CONFIDENCE_RUNWAY_SCORE) {
    return { runway: best.runway, confidence: 'medium' };
  }

  return { runway: best.runway, confidence: 'low' };
}

function buildTrack(
  row: AggregatedTrackRow,
  airportIdent: string,
  bounds: AirportBounds['footprint'],
  runwayGeometry: RunwayGeometry[],
): AirportMovementTrack {
  const path = (row.path ?? []).map(normalizeTrackPoint);
  const firstPoint = path[0]!;
  const lastPoint = path[path.length - 1]!;
  const startsNearAirport = inBounds(firstPoint, bounds);
  const endsNearAirport = inBounds(lastPoint, bounds);
  const altitudeStart = firstPoint.altitude;
  const altitudeEnd = lastPoint.altitude;
  const maxAltitude = path.reduce<number | null>(
    (best, point) => (point.altitude == null ? best : best == null ? point.altitude : Math.max(best, point.altitude)),
    null,
  );
  const maxSpeed = path.reduce<number | null>(
    (best, point) => (point.speed == null ? best : best == null ? point.speed : Math.max(best, point.speed)),
    null,
  );
  const classification = classifyMovement({
    origin: row.origin,
    destination: row.destination,
    airportIdent,
    startsNearAirport,
    endsNearAirport,
    altitudeStart,
    altitudeEnd,
    maxAltitude,
    maxSpeed,
  });
  const runwayInference = inferRunway(classification.movement, path, runwayGeometry);

  return {
    icao24: row.icao24,
    callsign: row.callsign,
    origin: row.origin,
    destination: row.destination,
    firstSeen: Math.floor(new Date(row.first_seen).getTime() / 1000),
    lastSeen: Math.floor(new Date(row.last_seen).getTime() / 1000),
    pointCount: row.point_count,
    startsNearAirport,
    endsNearAirport,
    altitudeStart,
    altitudeEnd,
    altitudeDelta: classification.altitudeDelta,
    movement: classification.movement,
    movementConfidence: classification.confidence,
    movementReason: classification.reason,
    inferredRunway: runwayInference.runway,
    runwayConfidence: runwayInference.confidence,
    weather: null,
    path,
  };
}

async function loadMetarHistory(station: string, start: Date, end: Date): Promise<AirportMovementWeather[]> {
  const result = await db.execute(sql`
    SELECT
      fetched_at,
      raw,
      station,
      observation_time,
      wind_direction,
      wind_speed,
      wind_gust,
      visibility,
      ceiling,
      flight_category
    FROM ingest.metar
    WHERE station = ${station}
      AND coalesce(observation_time, fetched_at) >= ${new Date(start.getTime() - 6 * 60 * 60 * 1000)}
      AND coalesce(observation_time, fetched_at) < ${new Date(end.getTime() + 6 * 60 * 60 * 1000)}
    ORDER BY coalesce(observation_time, fetched_at) ASC, id ASC
  `);

  return (result.rows as unknown as MetarRow[]).map((row) => ({
    raw: row.raw,
    station: row.station,
    observationTime: new Date(row.observation_time ?? row.fetched_at).getTime(),
    windDirection: row.wind_direction,
    windSpeed: row.wind_speed,
    windGust: row.wind_gust,
    visibility: row.visibility,
    ceiling: row.ceiling,
    flightCategory: row.flight_category ?? 'VFR',
  }));
}

function nearestWeather(
  observations: AirportMovementWeather[],
  targetTimeMs: number,
): AirportMovementWeather | null {
  let best: AirportMovementWeather | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const observation of observations) {
    const delta = Math.abs(observation.observationTime - targetTimeMs);
    if (delta < bestDelta) {
      best = observation;
      bestDelta = delta;
    }
  }

  return best;
}

export function resolveAirportMovementsDate(input: string | null | undefined, timeZone = DEFAULT_TIME_ZONE): string {
  const trimmed = input?.trim();
  return trimmed && isValidDateInput(trimmed) ? trimmed : getDefaultDate(timeZone);
}

export function resolveAirportIdent(input: string | null | undefined): string {
  const trimmed = input?.trim().toUpperCase();
  return trimmed && isValidAirportIdent(trimmed) ? trimmed : DEFAULT_AIRPORT.ident;
}

export function resolveMovementFilter(input: string | null | undefined): AirportMovementFilter {
  const trimmed = input?.trim().toLowerCase();
  return trimmed && isValidMovementFilter(trimmed) ? trimmed : 'all';
}

export async function getAirportMovements(args: {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  timeZone?: string;
}): Promise<AirportMovementsPayload> {
  const airport = findAirportByIdent(args.airportIdent) ?? DEFAULT_AIRPORT;
  const airportIdent = airport.ident;
  const timeZone = args.timeZone ?? DEFAULT_TIME_ZONE;
  const { start, end } = getTimeZoneDayRange(args.date, timeZone);
  const runwayGeometry = await loadRunwayGeometry(airportIdent);
  const bounds = buildAirportBounds(airport.latitude, airport.longitude, runwayGeometry);
  const weatherHistory = await loadMetarHistory(airportIdent, start, end);

  const result = await db.execute(sql`
    WITH filtered_points AS (
      SELECT
        sv.icao24,
        nullif(trim(sv.flight), '') AS callsign,
        fr.origin,
        fr.destination,
        sv.polled_at,
        sv.latitude,
        sv.longitude,
        coalesce(sv.altitude_geom, sv.altitude_baro) AS altitude,
        coalesce(sv.track, sv.true_heading) AS heading,
        sv.ground_speed
      FROM ingest.adsblol_state_vectors sv
      LEFT JOIN public.flight_routes fr
        ON upper(regexp_replace(coalesce(sv.flight, ''), '\s+', '', 'g')) = fr.callsign
      WHERE sv.polled_at >= ${start}
        AND sv.polled_at < ${end}
        AND sv.latitude IS NOT NULL
        AND sv.longitude IS NOT NULL
        AND sv.latitude BETWEEN ${bounds.approach.south} AND ${bounds.approach.north}
        AND sv.longitude BETWEEN ${bounds.approach.west} AND ${bounds.approach.east}
    )
    SELECT
      fp.icao24,
      coalesce(max(fp.callsign) FILTER (WHERE fp.callsign IS NOT NULL), upper(fp.icao24)) AS callsign,
      fp.origin,
      fp.destination,
      min(fp.polled_at) AS first_seen,
      max(fp.polled_at) AS last_seen,
      count(*)::int AS point_count,
      json_agg(
        json_build_array(
          extract(epoch from fp.polled_at)::bigint,
          fp.latitude,
          fp.longitude,
          fp.altitude,
          fp.heading,
          fp.ground_speed
        )
        ORDER BY fp.polled_at
      ) AS path
    FROM filtered_points fp
    GROUP BY
      fp.icao24,
      coalesce(fp.callsign, upper(fp.icao24)),
      fp.origin,
      fp.destination
    HAVING count(*) >= ${MIN_POINT_COUNT}
      AND bool_or(
        fp.latitude BETWEEN ${bounds.footprint.south} AND ${bounds.footprint.north}
        AND fp.longitude BETWEEN ${bounds.footprint.west} AND ${bounds.footprint.east}
      )
    ORDER BY max(fp.polled_at) DESC
  `);

  const allTracks = (result.rows as unknown as AggregatedTrackRow[]).map((row) => {
    const track = buildTrack(row, airportIdent, bounds.footprint, runwayGeometry);
    const weatherReferenceTime =
      track.movement === 'departure' ? track.firstSeen * 1000 : track.lastSeen * 1000;
    return {
      ...track,
      weather: nearestWeather(weatherHistory, weatherReferenceTime),
    };
  });

  const tracks =
    args.movement === 'all' ? allTracks : allTracks.filter((track) => track.movement === args.movement);

  return {
    airportIdent,
    airportName: airport.name,
    airportLatitude: airport.latitude,
    airportLongitude: airport.longitude,
    date: args.date,
    timezone: timeZone,
    movement: args.movement,
    aircraftCount: tracks.length,
    pointCount: tracks.reduce((sum, track) => sum + track.pointCount, 0),
    counts: {
      arrivals: allTracks.filter((track) => track.movement === 'arrival').length,
      departures: allTracks.filter((track) => track.movement === 'departure').length,
      unknown: allTracks.filter((track) => track.movement === 'unknown').length,
    },
    runwayGeometry,
    tracks,
  };
}
