import { resolveAirlineIcao } from '@/lib/airlineCodeMap';

function normalizeFlightCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

/**
 * Check whether an OpenSky ADS-B callsign (ICAO prefix + flight number)
 * corresponds to a Flighty arrival row identified by its IATA airline code
 * and numeric flight number.
 *
 * Matching strategy:
 *  1. The callsign must end with the flight number (with or without leading zeros).
 *  2. The remaining prefix is compared against the airline's ICAO code
 *     (looked up from the IATA→ICAO map), or as a fallback, checked with
 *     `startsWith(iata)` for airlines not yet in the map.
 */
export function callsignMatchesFlighty(
  openskyCallsign: string,
  airlineIata: string,
  flightNum: string,
  flight?: string,
): boolean {
  const cs = normalizeFlightCode(openskyCallsign);
  const directFlight = normalizeFlightCode(flight ?? '');

  if (directFlight && cs === directFlight) {
    return true;
  }

  const rawNum = flightNum.toUpperCase();
  const num = rawNum.replace(/^0+/, '') || '0';

  if (!cs.endsWith(rawNum) && !cs.endsWith(num)) return false;

  const tailLen = cs.endsWith(rawNum) ? rawNum.length : num.length;
  const prefix = cs.slice(0, Math.max(0, cs.length - tailLen));
  const ia = airlineIata.toUpperCase();

  // Exact IATA match (some callsigns use IATA directly)
  if (prefix === ia) return true;

  // Look up the ICAO code from the airline map
  const icao = resolveAirlineIcao(ia);
  if (icao && prefix === icao) return true;

  // Fallback: prefix starts with the IATA code (covers unmapped airlines)
  if (prefix.startsWith(ia)) return true;

  return false;
}
