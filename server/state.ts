import type { Flight } from './opensky/types';
import { isBuitenveldertbaanApproach } from './opensky/detector';

export interface FlightState {
  allFlights: Flight[];
  approachingFlights: Flight[];
  buitenveldertbaanActive: boolean;
  lastUpdateMs: number;
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'buitenveldertbaan_activated'; flights: Flight[] }
  | { type: 'buitenveldertbaan_deactivated' }
  | { type: 'new_approach'; flight: Flight };

export type EventCallback = (event: StateChangeEvent) => void;

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

  onEvent(callback: EventCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  getState(): FlightState {
    return { ...this.state };
  }

  update(flights: Flight[]): void {
    const approaching = flights.filter(isBuitenveldertbaanApproach);
    const now = Date.now();

    for (const flight of approaching) {
      if (!this.knownApproachFlightIds.has(flight.id)) {
        this.knownApproachFlightIds.add(flight.id);
        this.emit({ type: 'new_approach', flight });
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
    };

    if (!wasActive && isActive)
      this.emit({ type: 'buitenveldertbaan_activated', flights: approaching });
    else if (wasActive && !isActive) this.emit({ type: 'buitenveldertbaan_deactivated' });
    this.emit({ type: 'flights_updated', state: this.getState() });
  }

  private emit(event: StateChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
