import type { Flight } from './types';

// Buitenveldertbaan runway 27 — planes approach from the east heading ~267° true
const MIN_HEADING = 257;
const MAX_HEADING = 277;
const MIN_ALTITUDE_FT = 200;
const MAX_ALTITUDE_FT = 3000;

// Approach corridor (east of airport, planes fly over Buitenveldert/Amstelveen)
const CORRIDOR_LAT_MIN = 52.29;
const CORRIDOR_LAT_MAX = 52.34;
const CORRIDOR_LON_MIN = 4.7; // near threshold
const CORRIDOR_LON_MAX = 5.15; // ~15km east

// RWY 27 threshold coordinates
export const RWY27_THRESHOLD: [number, number] = [52.3128, 4.7839];

// Approach cone polygon for map visualization (trapezoid extending east from threshold)
export const APPROACH_CONE: [number, number][] = [
  [52.322, 4.78], // near-north (close to threshold)
  [52.34, 5.1], // far-north (~12km east)
  [52.286, 5.1], // far-south
  [52.304, 4.78], // near-south
];

export function isBuitenveldertbaanApproach(flight: Flight): boolean {
  if (flight.onGround) return false;
  if (flight.alt < MIN_ALTITUDE_FT || flight.alt > MAX_ALTITUDE_FT) return false;
  if (flight.track < MIN_HEADING || flight.track > MAX_HEADING) return false;

  // Must be descending, or very low (could be in level segment near threshold)
  if (flight.verticalRate > 100 && flight.alt > 500) return false;

  // Position within approach corridor
  if (flight.lat < CORRIDOR_LAT_MIN || flight.lat > CORRIDOR_LAT_MAX) return false;
  if (flight.lon < CORRIDOR_LON_MIN || flight.lon > CORRIDOR_LON_MAX) return false;

  return true;
}
