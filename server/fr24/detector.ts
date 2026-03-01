import type { LiveFeedFlight } from './proto.js';

const MIN_HEADING = 250;
const MAX_HEADING = 290;
const MAX_ALTITUDE_FT = 3000;

export function isOnRunway09Approach(flight: LiveFeedFlight): boolean {
  const dest = flight.extraInfo?.route?.to;
  if (dest !== 'AMS') return false;
  if (flight.onGround) return false;
  if (flight.alt > MAX_ALTITUDE_FT) return false;
  if (flight.alt <= 0) return false;
  if (flight.track < MIN_HEADING || flight.track > MAX_HEADING) return false;
  return true;
}
