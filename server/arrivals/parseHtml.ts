import type { FlightyArrivalRow } from './types';

const INITIAL_MARKER = 'initialFlights';
/** Closes the last flight object and the `initialFlights` array; unique on the AMS arrivals document. */
const ARRAY_END_MARKER = '\\"}}],';

/**
 * Extracts the `initialFlights` JSON array from Flighty's server-rendered HTML.
 * Relies on the embedded RSC payload, not the hydrated client bundle.
 */
export function extractInitialFlightsFromHtml(html: string): FlightyArrivalRow[] | null {
  const mi = html.indexOf(INITIAL_MARKER);
  if (mi < 0) return null;

  const bracket = html.indexOf('[', mi);
  if (bracket < 0) return null;

  const endInner = html.indexOf(ARRAY_END_MARKER, bracket);
  if (endInner < 0) return null;

  const after = html.slice(endInner, endInner + 80);
  if (!after.includes('\\"slug\\"')) {
    return null;
  }

  // endInner points at `\"` before `}}],`; `]` is at +4, exclusive end +5 includes it but not the trailing comma.
  const slice = html.slice(bracket, endInner + 5);
  const jsonText = slice.replace(/\\"/g, '"');
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as FlightyArrivalRow[];
  } catch {
    return null;
  }
}
