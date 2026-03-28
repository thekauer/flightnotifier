const AMS = 'Europe/Amsterdam';

function amsCalendarParts(ms: number): { y: number; m: number; d: number } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: AMS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = dtf.formatToParts(new Date(ms));
  const y = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const m = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const d = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
  return { y, m, d };
}

/**
 * Returns UTC epoch ms for a wall-clock time on a given Amsterdam calendar date, or null if not found.
 */
function utcMsForAmsWallClock(year: number, month: number, day: number, hour: number, minute: number): number | null {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: AMS,
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
    const parts = dtf.formatToParts(new Date(t));
    const y2 = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
    const m2 = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
    const d2 = parseInt(parts.find((p) => p.type === 'day')!.value, 10);
    const h2 = parseInt(parts.find((p) => p.type === 'hour')!.value, 10);
    const min2 = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
    if (y2 === year && m2 === month && d2 === day && h2 === hour && min2 === minute) {
      return t;
    }
  }
  return null;
}

const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

/**
 * Minutes from `nowMs` until the next occurrence of `hh:mm` on the Amsterdam wall clock
 * (typically today's date, or tomorrow if that time today has already passed).
 */
export function minutesFromNowUntilAmsClock(nowMs: number, hhmm: string): number | null {
  const m = CLOCK_RE.exec(hhmm.trim());
  if (!m) return null;
  const hour = parseInt(m[1]!, 10);
  const minute = parseInt(m[2]!, 10);
  if (hour > 23 || minute > 59) return null;

  const { y, m: mo, d } = amsCalendarParts(nowMs);
  let target = utcMsForAmsWallClock(y, mo, d, hour, minute);
  if (target === null) return null;

  if (target < nowMs) {
    const nextGuess = new Date(nowMs + 26 * 60 * 60 * 1000);
    const p2 = amsCalendarParts(nextGuess.getTime());
    target = utcMsForAmsWallClock(p2.y, p2.m, p2.d, hour, minute);
  }
  if (target === null) return null;
  if (target < nowMs) {
    return 0;
  }
  return Math.round((target - nowMs) / 60_000);
}
