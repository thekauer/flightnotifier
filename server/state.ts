import type { LiveFeedFlight } from './fr24/proto.js';
import { isOnRunway09Approach } from './fr24/detector.js';

export interface FlightState {
  allFlights: LiveFeedFlight[];
  approachingFlights: LiveFeedFlight[];
  runway09Active: boolean;
  lastUpdateMs: number;
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'runway09_activated'; flights: LiveFeedFlight[] }
  | { type: 'runway09_deactivated' }
  | { type: 'new_approach'; flight: LiveFeedFlight };

export type EventCallback = (event: StateChangeEvent) => void;

const RUNWAY_INACTIVE_TIMEOUT_MS = 120_000;

export class FlightStateManager {
  private state: FlightState = {
    allFlights: [],
    approachingFlights: [],
    runway09Active: false,
    lastUpdateMs: 0,
  };
  private lastApproachTime = 0;
  private knownApproachFlightIds = new Set<number>();
  private listeners: EventCallback[] = [];

  onEvent(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  getState(): FlightState {
    return { ...this.state };
  }

  update(flights: LiveFeedFlight[]): void {
    const approaching = flights.filter(isOnRunway09Approach);
    const now = Date.now();

    for (const flight of approaching) {
      if (!this.knownApproachFlightIds.has(flight.flightId)) {
        this.knownApproachFlightIds.add(flight.flightId);
        this.emit({ type: 'new_approach', flight });
      }
    }

    const currentIds = new Set(approaching.map((f) => f.flightId));
    for (const id of this.knownApproachFlightIds) {
      if (!currentIds.has(id)) this.knownApproachFlightIds.delete(id);
    }

    const wasActive = this.state.runway09Active;
    if (approaching.length > 0) this.lastApproachTime = now;
    const isActive =
      approaching.length > 0 || now - this.lastApproachTime < RUNWAY_INACTIVE_TIMEOUT_MS;

    this.state = {
      allFlights: flights,
      approachingFlights: approaching,
      runway09Active: isActive,
      lastUpdateMs: now,
    };

    if (!wasActive && isActive) this.emit({ type: 'runway09_activated', flights: approaching });
    else if (wasActive && !isActive) this.emit({ type: 'runway09_deactivated' });
    this.emit({ type: 'flights_updated', state: this.getState() });
  }

  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
