import type { Flight } from './types';
import type { RunwayDirection } from '@/server/runway/types';

// --- RWY 27 (planes approach from the east heading ~267° true) ---------------

const RWY27_MIN_HEADING = 257;
const RWY27_MAX_HEADING = 277;

// --- RWY 09 (planes approach from the west heading ~087° true) ---------------

const RWY09_MIN_HEADING = 77;
const RWY09_MAX_HEADING = 97;

// --- Common altitude limits --------------------------------------------------

const MIN_ALTITUDE_FT = 200;
const MAX_ALTITUDE_FT = 3000;

// --- RWY 27 approach corridor (east of airport) -----------------------------

const RWY27_CORRIDOR_LAT_MIN = 52.29;
const RWY27_CORRIDOR_LAT_MAX = 52.34;
const RWY27_CORRIDOR_LON_MIN = 4.7;  // near threshold
const RWY27_CORRIDOR_LON_MAX = 5.15; // ~15km east

// --- RWY 09 approach corridor (west of airport) -----------------------------

const RWY09_CORRIDOR_LAT_MIN = 52.29;
const RWY09_CORRIDOR_LAT_MAX = 52.34;
const RWY09_CORRIDOR_LON_MIN = 4.4;  // ~15km west
const RWY09_CORRIDOR_LON_MAX = 4.78; // near threshold

// --- Threshold coordinates ---------------------------------------------------

export const RWY27_THRESHOLD: [number, number] = [52.3128, 4.7839];
export const RWY09_THRESHOLD: [number, number] = [52.3092, 4.8356];

// --- Approach cone polygons for map visualization ----------------------------

export const APPROACH_CONE_27: [number, number][] = [
  [52.322, 4.78],  // near-north (close to threshold)
  [52.34, 5.1],    // far-north (~12km east)
  [52.286, 5.1],   // far-south
  [52.304, 4.78],  // near-south
];

export const APPROACH_CONE_09: [number, number][] = [
  [52.322, 4.835], // near-north (close to threshold)
  [52.34, 4.5],    // far-north (~12km west)
  [52.286, 4.5],   // far-south
  [52.304, 4.835], // near-south
];

// Keep legacy export for backward compatibility
export const APPROACH_CONE = APPROACH_CONE_27;

/**
 * Detect if a flight is on approach to the Buitenveldertbaan (either direction).
 * Returns true for BOTH RWY 27 and RWY 09 approaches.
 */
export function isBuitenveldertbaanApproach(flight: Flight): boolean {
  return detectApproachDirection(flight) !== null;
}

/**
 * Detect which runway direction a flight is approaching, if any.
 * Returns '27', '09', or null if not on approach.
 */
export function detectApproachDirection(flight: Flight): RunwayDirection | null {
  if (flight.onGround) return null;
  if (flight.alt < MIN_ALTITUDE_FT || flight.alt > MAX_ALTITUDE_FT) return null;

  // Must be descending, or very low (could be in level segment near threshold)
  if (flight.verticalRate > 100 && flight.alt > 500) return null;

  // Check RWY 27 corridor (approaching from east, heading ~267)
  if (
    flight.track >= RWY27_MIN_HEADING &&
    flight.track <= RWY27_MAX_HEADING &&
    flight.lat >= RWY27_CORRIDOR_LAT_MIN &&
    flight.lat <= RWY27_CORRIDOR_LAT_MAX &&
    flight.lon >= RWY27_CORRIDOR_LON_MIN &&
    flight.lon <= RWY27_CORRIDOR_LON_MAX
  ) {
    return '27';
  }

  // Check RWY 09 corridor (approaching from west, heading ~087)
  if (
    flight.track >= RWY09_MIN_HEADING &&
    flight.track <= RWY09_MAX_HEADING &&
    flight.lat >= RWY09_CORRIDOR_LAT_MIN &&
    flight.lat <= RWY09_CORRIDOR_LAT_MAX &&
    flight.lon >= RWY09_CORRIDOR_LON_MIN &&
    flight.lon <= RWY09_CORRIDOR_LON_MAX
  ) {
    return '09';
  }

  return null;
}
