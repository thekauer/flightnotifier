import type { ScheduledArrival } from '@/lib/types';
import type { Flight } from './opensky/types';
import { isBuitenveldertbaanApproach, detectApproachDirection } from './opensky/detector';
import type { RunwayDirection, RunwayPrediction } from './runway/types';
import type { ApproachDirection } from './runway/signals';

export interface FlightState {
  allFlights: Flight[];
  approachingFlights: Flight[];
  buitenveldertbaanActive: boolean;
  lastUpdateMs: number;
  weather?: import('@/lib/api/weather').MetarData | null;
  runwayPredictions?: RunwayPrediction[];
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'buitenveldertbaan_activated'; flights: Flight[] }
  | { type: 'buitenveldertbaan_deactivated' }
  | { type: 'new_approach'; flight: Flight }
  | { type: 'runway_predictions'; predictions: RunwayPrediction[] }
  | { type: 'visibility_predictions'; predictions: import('./visibility/types').VisibilityPrediction[] }
  | { type: 'schedule_updated'; schedule: ScheduledArrival[]; fetchedAt: number }
  | { type: 'weather_updated'; weather: import('@/lib/api/weather').MetarData | null; fetchedAt: number };

export type EventCallback = (event: StateChangeEvent) => void;

export interface ApproachRecord {
  flightId: string;
  callsign: string;
  runway: RunwayDirection;
  timestamp: number;
  heading: number;
  lat: number;
  lon: number;
}

const RUNWAY_INACTIVE_TIMEOUT_MS = 120_000;

export class FlightStateManager {
  private state: FlightState = {
    allFlights: [],
    approachingFlights: [],
    buitenveldertbaanActive: false,
    lastUpdateMs: 0,
  };
  private lastApproachTime = 0;
  private knownApproachFlightIds = new Set<string>();
  private listeners: EventCallback[] = [];

  /** Recent approach directions for the active-config signal (last 60 min). */
  private recentApproachDirections: ApproachDirection[] = [];

  /** Callback fired when a new approach is confirmed with direction info. */
  private onApproachConfirmed: ((record: ApproachRecord) => void) | null = null;

  onEvent(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  setOnApproachConfirmed(callback: (record: ApproachRecord) => void): void {
    this.onApproachConfirmed = callback;
  }

  getState(): FlightState {
    return { ...this.state };
  }

  getRecentApproachDirections(): ApproachDirection[] {
    // Prune entries older than 60 minutes
    const cutoff = Date.now() - 60 * 60 * 1000;
    this.recentApproachDirections = this.recentApproachDirections.filter((a) => a.timestamp >= cutoff);
    return [...this.recentApproachDirections];
  }

  update(flights: Flight[], runwayPredictions?: RunwayPrediction[]): void {
    const approaching = flights.filter(isBuitenveldertbaanApproach);
    const now = Date.now();

    for (const flight of approaching) {
      if (!this.knownApproachFlightIds.has(flight.id)) {
        this.knownApproachFlightIds.add(flight.id);
        this.emit({ type: 'new_approach', flight });

        // Detect direction and record for history and active-config signal
        const direction = detectApproachDirection(flight);
        if (direction) {
          this.recentApproachDirections.push({ timestamp: now, runway: direction });
        }
        if (direction && this.onApproachConfirmed) {
          this.onApproachConfirmed({
            flightId: flight.id,
            callsign: flight.callsign,
            runway: direction,
            timestamp: now,
            heading: flight.track,
            lat: flight.lat,
            lon: flight.lon,
          });
        }
      }
    }

    const currentIds = new Set(approaching.map((f) => f.id));
    for (const id of this.knownApproachFlightIds) {
      if (!currentIds.has(id)) this.knownApproachFlightIds.delete(id);
    }

    const wasActive = this.state.buitenveldertbaanActive;
    if (approaching.length > 0) this.lastApproachTime = now;
    const isActive =
      approaching.length > 0 || now - this.lastApproachTime < RUNWAY_INACTIVE_TIMEOUT_MS;

    this.state = {
      allFlights: flights,
      approachingFlights: approaching,
      buitenveldertbaanActive: isActive,
      lastUpdateMs: now,
      runwayPredictions: runwayPredictions ?? this.state.runwayPredictions,
    };

    if (!wasActive && isActive)
      this.emit({ type: 'buitenveldertbaan_activated', flights: approaching });
    else if (wasActive && !isActive) this.emit({ type: 'buitenveldertbaan_deactivated' });
    if (runwayPredictions) {
      this.emit({ type: 'runway_predictions', predictions: runwayPredictions });
    }
    this.emit({ type: 'flights_updated', state: this.getState() });
  }

  /** Update the state with runway predictions and emit them. */
  emitRunwayPredictions(predictions: RunwayPrediction[]): void {
    this.state = { ...this.state, runwayPredictions: predictions };
    this.emit({ type: 'runway_predictions', predictions });
  }

  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
