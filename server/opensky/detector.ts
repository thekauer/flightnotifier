import type { Flight } from './types';
import type { RunwayDirection } from '@/server/runway/types';
import {
  APPROACH_CONE_27,
  APPROACH_CONE_09,
  APPROACH_CONE,
  RWY27_THRESHOLD,
  RWY09_THRESHOLD,
  RWY27_MIN_HEADING,
  RWY27_MAX_HEADING,
  RWY09_MIN_HEADING,
  RWY09_MAX_HEADING,
  RWY27_CORRIDOR_LAT_MIN,
  RWY27_CORRIDOR_LAT_MAX,
  RWY27_CORRIDOR_LON_MIN,
  RWY27_CORRIDOR_LON_MAX,
  RWY09_CORRIDOR_LAT_MIN,
  RWY09_CORRIDOR_LAT_MAX,
  RWY09_CORRIDOR_LON_MIN,
  RWY09_CORRIDOR_LON_MAX,
  isInsideApproachCone27,
  pathIntersectsApproachCone27,
} from '@/lib/approachCone';

// Re-export everything that other modules previously imported from here
export {
  APPROACH_CONE_27,
  APPROACH_CONE_09,
  APPROACH_CONE,
  RWY27_THRESHOLD,
  RWY09_THRESHOLD,
  isInsideApproachCone27,
  pathIntersectsApproachCone27,
};

// --- Common altitude limits --------------------------------------------------

const MIN_ALTITUDE_FT = 200;
const MAX_ALTITUDE_FT = 3000;

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
