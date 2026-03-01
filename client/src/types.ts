export interface LiveFeedFlight {
  flightId: number;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  track: number;
  onGround: boolean;
  source: number;
  timestamp: number;
  extraInfo?: {
    type?: string;
    reg?: string;
    flight?: string;
    route?: { from?: string; to?: string };
  };
}

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
