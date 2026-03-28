import type { FlightyArrivalRow } from './types';
import { minutesFromNowUntilAmsClock } from './amsClock';

const CLOCK = /^(\d{1,2}:\d{2})$/;

function statusTexts(row: FlightyArrivalRow): string {
  return row.status
    .map((s) => s.text ?? '')
    .join(' ')
    .toLowerCase();
}

export function isCanceledOrDiverted(row: FlightyArrivalRow): boolean {
  const s = statusTexts(row);
  return s.includes('canceled') || s.includes('cancelled') || s.includes('diverted');
}

/**
 * Picks the best arrival clock time (HH:MM, Amsterdam-local) for ETA math.
 */
export function pickArrivalClock(row: FlightyArrivalRow): string | null {
  const nt = row.newTime.text.trim();
  if (CLOCK.test(nt)) {
    return nt;
  }

  for (const part of row.status) {
    if (part.type !== 'text' || !part.text) continue;
    const est = /Estimated\s+(\d{1,2}:\d{2})/i.exec(part.text);
    if (est) return est[1]!;
    if (/^on time$/i.test(part.text.trim())) {
      const ot = row.originalTime.text.trim();
      if (CLOCK.test(ot)) return ot;
    }
  }

  const ot = row.originalTime.text.trim();
  if (CLOCK.test(ot)) {
    return ot;
  }

  const joined = row.status.map((s) => s.text ?? '').join(' ');
  const any = /(\d{1,2}:\d{2})/.exec(joined);
  return any ? any[1]! : null;
}

export function estimatedMinutesFromRow(row: FlightyArrivalRow, nowMs: number): number | null {
  const clock = pickArrivalClock(row);
  if (!clock) return null;
  return minutesFromNowUntilAmsClock(nowMs, clock);
}

export function flightyDisplayCallsign(row: FlightyArrivalRow): string {
  return `${row.airline.iata} ${row.flightNumber}`.trim();
}
