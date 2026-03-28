import type { MetarData } from '@/lib/api/weather';
import type { RunwayHistoryStore } from './historyStore';
import type { RunwayHistoryEntry } from './types';

/**
 * Wind signal: probability that RWY 27 is active based on wind direction.
 * Weight: 0.45
 *
 * RWY 27 (heading 267) is favored when wind blows from ~200-340 degrees
 * (wind comes from the west/southwest/northwest, planes land INTO the wind heading west).
 * RWY 09 (heading 087) is favored when wind blows from ~020-160 degrees
 * (wind from the east, planes land heading east).
 *
 * Returns 0..1 where 1.0 = strongly favors RWY 27, 0.0 = strongly favors RWY 09.
 */
export function windSignal(metar: MetarData | null): number {
  if (!metar || metar.windDirection === null) return 0.5; // no data, neutral
  if (metar.windSpeed !== null && metar.windSpeed < 3) return 0.5; // calm winds, neutral

  const dir = metar.windDirection;

  // RWY 27 favored: wind from 200-340 (landing into headwind heading ~267)
  if (dir >= 200 && dir <= 340) {
    // Peak favorability at 267 (direct headwind for RWY 27)
    const diff = Math.abs(dir - 267);
    // At 267: 1.0, at 200 or 340: ~0.7
    return 0.7 + 0.3 * (1 - diff / 73);
  }

  // RWY 09 favored: wind from 020-160 (landing into headwind heading ~087)
  if (dir >= 20 && dir <= 160) {
    const diff = Math.abs(dir - 87);
    // At 87: 0.0, at 20 or 160: ~0.3
    return 0.3 * (diff / 73);
  }

  // Transition zones: 340-020 (north) and 160-200 (south) — neutral
  return 0.5;
}

/**
 * History signal: probability of RWY 27 based on past landings for this callsign.
 * Weight: 0.25
 *
 * If we have flight-specific history, use it.
 * Otherwise fall back to the global base rate (~17% for BVB in reality).
 *
 * Returns 0..1 where 1.0 = always landed on 27, 0.0 = always on 09.
 */
export function historySignal(
  callsign: string,
  store: RunwayHistoryStore,
): number {
  const history = store.getHistory(callsign);

  if (history.length >= 3) {
    // Enough flight-specific data
    const rwy27Count = history.filter((h) => h.runway === '27').length;
    return rwy27Count / history.length;
  }

  // Fall back to base rate
  const { rwy27Rate } = store.getBaseRate();
  return rwy27Rate;
}

/**
 * Time-of-day signal: probability of RWY 27 being active.
 * Weight: 0.15
 *
 * Buitenveldertbaan (RWY 09/27) has noise restrictions:
 * - Night (23:00-06:00 local): essentially never used → 0.0
 * - Early morning (06:00-07:00): rarely used → 0.1
 * - Day (07:00-23:00): normal operations → 0.5 (neutral, let other signals decide)
 *
 * Returns 0..1 where higher = more likely RWY 27 is in use.
 * Note: this is really about "is the Buitenveldertbaan active at all" not direction.
 * We use it as a suppression factor — at night, the runway is unlikely to be used either direction.
 */
export function timeOfDaySignal(): number {
  // Amsterdam is UTC+1 (CET) / UTC+2 (CEST)
  // Approximate: always use UTC+1 for simplicity (close enough for noise rules)
  const now = new Date();
  const utcHour = now.getUTCHours();
  const localHour = (utcHour + 1) % 24; // CET approximation

  if (localHour >= 23 || localHour < 6) return 0.0;   // Night
  if (localHour >= 6 && localHour < 7) return 0.1;     // Early morning
  return 0.5;                                            // Day — neutral, let other signals decide direction
}

export interface ApproachDirection {
  timestamp: number;
  runway: '09' | '27';
}

/**
 * Active configuration signal: probability of RWY 27 based on recent approach observations.
 * Weight: 0.15
 *
 * Checks the direction of recent approaches and scores toward the actually-active direction.
 * - Recent approaches on RWY 27 → high score (favors 27)
 * - Recent approaches on RWY 09 → low score (favors 09)
 * - No recent approaches → 0.5 (neutral)
 *
 * Takes an array of recent approach directions (from the detector).
 * Returns 0..1 where 1.0 = strongly favors RWY 27.
 */
export function activeConfigSignal(recentApproachDirections: ApproachDirection[]): number {
  if (recentApproachDirections.length === 0) return 0.5; // neutral — no data

  const now = Date.now();

  // Only consider approaches within the last 60 minutes
  const recent = recentApproachDirections.filter(
    (a) => (now - a.timestamp) / 60_000 <= 60,
  );
  if (recent.length === 0) return 0.5;

  // Weight more recent approaches higher
  const rwy27Count = recent.filter((a) => a.runway === '27').length;
  const rwy27Ratio = rwy27Count / recent.length;

  // Recency boost: if the latest approach is very recent, amplify the signal
  const latestApproach = Math.max(...recent.map((a) => a.timestamp));
  const minutesAgo = (now - latestApproach) / 60_000;

  // Blend toward neutral as time passes
  let recencyFactor: number;
  if (minutesAgo <= 15) recencyFactor = 1.0;
  else if (minutesAgo <= 60) recencyFactor = 0.6;
  else recencyFactor = 0.2;

  // Interpolate between neutral (0.5) and observed ratio based on recency
  return 0.5 + (rwy27Ratio - 0.5) * recencyFactor;
}
