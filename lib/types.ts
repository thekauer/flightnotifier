export interface Flight {
  id: string;
  callsign: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  track: number;
  verticalRate: number;
  onGround: boolean;
  timestamp: number;
  aircraftType: string | null;
  registration: string | null;
  originCountry: string;
}

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
