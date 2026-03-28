import { resolveAirlineIata } from './airlineCodeMap';

/**
 * Extract the airline ICAO prefix from a callsign.
 * Takes all leading alphabetic characters (e.g. "KLM" from "KLM1234").
 */
function extractAirlinePrefix(callsign: string): string | null {
  const match = callsign.match(/^([A-Z]+)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Return a public airline logo URL for a given callsign, or null if the
 * airline cannot be determined.
 *
 * Uses Google Flights CDN which serves logos by IATA code.
 */
export function getAirlineLogoUrl(callsign: string): string | null {
  const icaoPrefix = extractAirlinePrefix(callsign);
  if (!icaoPrefix) return null;

  const iata = resolveAirlineIata(icaoPrefix);
  if (!iata) return null;

  return `https://www.gstatic.com/flights/airline_logos/32px/${iata}.png`;
}
