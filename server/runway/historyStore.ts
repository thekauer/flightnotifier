import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import type { RunwayHistoryEntry, RunwayDirection } from './types';

const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const DATA_FILE = 'data/runway-history.json';

/**
 * Strip trailing alpha characters from a callsign to normalize airline
 * variants (e.g. "KLM1234A" -> "KLM1234").
 */
function normalizeCallsign(callsign: string): string {
  return callsign
    .toUpperCase()
    .trim()
    .replace(/[A-Z]+$/, (match) => {
      // Keep the match if the entire callsign is alpha (it's just a name)
      // Only strip trailing alpha if there are leading digits before it
      return '';
    })
    // If the above stripped everything, use original trimmed uppercase
    || callsign.toUpperCase().trim();
}

export class RunwayHistoryStore {
  private entries: Map<string, RunwayHistoryEntry[]> = new Map();
  private dirty = false;

  constructor() {
    this.load();
  }

  /**
   * Record a confirmed landing observation.
   */
  record(entry: Omit<RunwayHistoryEntry, 'callsign'> & { callsign: string }): void {
    const normalized = normalizeCallsign(entry.callsign);
    const record: RunwayHistoryEntry = { ...entry, callsign: normalized };

    const existing = this.entries.get(normalized) || [];
    existing.push(record);
    this.entries.set(normalized, existing);
    this.dirty = true;
    this.save();
  }

  /**
   * Get landing history for a specific callsign.
   */
  getHistory(callsign: string): RunwayHistoryEntry[] {
    const normalized = normalizeCallsign(callsign);
    return this.entries.get(normalized) || [];
  }

  /**
   * Get the overall base rate of RWY 27 usage across all recorded landings.
   * Returns the fraction of landings on RWY 27 (0..1).
   * Falls back to ~0.17 (approximate real-world Buitenveldertbaan usage) if no data.
   */
  getBaseRate(): { rwy27Rate: number; total: number } {
    let rwy27Count = 0;
    let total = 0;

    for (const entries of this.entries.values()) {
      for (const entry of entries) {
        total++;
        if (entry.runway === '27') rwy27Count++;
      }
    }

    if (total === 0) {
      return { rwy27Rate: 0.17, total: 0 };
    }

    return { rwy27Rate: rwy27Count / total, total };
  }

  /**
   * Remove entries older than retention period.
   */
  prune(): void {
    const cutoff = Date.now() - RETENTION_MS;
    let pruned = false;

    for (const [key, entries] of this.entries) {
      const filtered = entries.filter((e) => e.timestamp >= cutoff);
      if (filtered.length !== entries.length) {
        pruned = true;
        if (filtered.length === 0) {
          this.entries.delete(key);
        } else {
          this.entries.set(key, filtered);
        }
      }
    }

    if (pruned) {
      this.dirty = true;
      this.save();
    }
  }

  private load(): void {
    try {
      if (!existsSync(DATA_FILE)) return;
      const raw = readFileSync(DATA_FILE, 'utf-8');
      const parsed: Record<string, RunwayHistoryEntry[]> = JSON.parse(raw);
      for (const [key, entries] of Object.entries(parsed)) {
        this.entries.set(key, entries);
      }
      console.log(`[RunwayHistory] Loaded ${this.entries.size} callsigns from disk`);
      // Prune old entries on load
      this.prune();
    } catch (err) {
      console.error('[RunwayHistory] Failed to load history file:', err);
    }
  }

  private save(): void {
    if (!this.dirty) return;
    try {
      const dir = dirname(DATA_FILE);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const obj: Record<string, RunwayHistoryEntry[]> = {};
      for (const [key, entries] of this.entries) {
        obj[key] = entries;
      }
      writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
      this.dirty = false;
    } catch (err) {
      console.error('[RunwayHistory] Failed to save history file:', err);
    }
  }
}
