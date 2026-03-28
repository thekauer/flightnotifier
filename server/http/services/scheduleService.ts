import type { ScheduledArrival } from '@/lib/types';
import { resolveIcaoFromIata } from '@/lib/airports';
import { getFlightyArrivals } from '@/server/arrivals/flightyClient';
import {
  estimatedMinutesFromRow,
  flightyDisplayCallsign,
  isCanceledOrDiverted,
} from '@/server/arrivals/flightRow';
import type { FlightyArrivalRow } from '@/server/arrivals/types';
import { buildSchedule } from '@/server/opensky/schedule';
import type { Flight } from '@/server/opensky/types';
import type { FlightState } from '@/server/state';

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function callsignMatchesFlighty(openskyCallsign: string, airlineIata: string, flightNum: string): boolean {
  const cs = openskyCallsign.toUpperCase().replace(/\s+/g, '');
  const rawNum = flightNum.toUpperCase();
  const num = rawNum.replace(/^0+/, '') || '0';
  if (!cs.endsWith(rawNum) && !cs.endsWith(num)) return false;

  const tailLen = cs.endsWith(rawNum) ? rawNum.length : num.length;
  const prefix = cs.slice(0, Math.max(0, cs.length - tailLen));
  const ia = airlineIata.toUpperCase();
  if (prefix === ia) return true;
  if (prefix.startsWith(ia)) return true;
  if (ia === 'KL' && prefix.startsWith('KLM')) return true;
  return false;
}

function findLiveFlight(rows: Flight[], airlineIata: string, flightNum: string): Flight | undefined {
  return rows.find((f) => f.callsign && callsignMatchesFlighty(f.callsign, airlineIata, flightNum));
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

  const callsign = flightyDisplayCallsign(row);
  const live = findLiveFlight(allFlights, row.airline.iata, row.flightNumber);
  const id = live?.id ?? `flighty:${row.id}`;
  const depIata = row.departure.iata?.toUpperCase() ?? '';
  const originIcao = resolveIcaoFromIata(depIata);
  const originCountry =
    live?.originCountry ||
    countryFromFlagPath(row.departure.flag) ||
    '';

  const distKm = live ? haversineKm(live.lat, live.lon, SCHIPHOL_LAT, SCHIPHOL_LON) : 0;

  return {
    id,
    callsign: live?.callsign?.trim() || callsign,
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
    isBuitenveldertbaan: id !== `flighty:${row.id}` && approachingIds.has(id),
  };
}

function buildFromFlighty(
  rows: FlightyArrivalRow[],
  fetchedAtMs: number,
  approachingIds: Set<string>,
  allFlights: Flight[],
): ScheduledArrival[] {
  const out: ScheduledArrival[] = [];
  for (const row of rows) {
    const a = rowToScheduledArrival(row, fetchedAtMs, approachingIds, allFlights);
    if (a) out.push(a);
  }
  return out.sort((x, y) => x.estimatedMinutes - y.estimatedMinutes);
}

function applyHorizon(schedule: ScheduledArrival[], horizonMinutes: number | null): ScheduledArrival[] {
  if (horizonMinutes === null || isNaN(horizonMinutes) || horizonMinutes <= 0) {
    return schedule;
  }
  const clamped = Math.min(Math.max(horizonMinutes, 1), 1440);
  return schedule.filter((a) => a.estimatedMinutes <= clamped);
}

export async function getScheduleForRequest(
  state: FlightState,
  horizonMinutes: number | null,
): Promise<ScheduledArrival[]> {
  const approachingIds = new Set(state.approachingFlights.map((f) => f.id));

  let schedule: ScheduledArrival[] = [];

  try {
    const flighty = await getFlightyArrivals();
    if (flighty && flighty.rows.length > 0) {
      schedule = buildFromFlighty(flighty.rows, flighty.fetchedAtMs, approachingIds, state.allFlights);
    }
  } catch (err) {
    console.error('[schedule] Flighty arrivals failed:', err);
  }

  if (schedule.length === 0) {
    schedule = buildSchedule(state.allFlights, approachingIds);
  }

  return applyHorizon(schedule, horizonMinutes);
}
