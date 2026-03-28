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
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
  originCountry: string;
  origin?: string;       // departure airport ICAO code
  destination?: string;  // arrival airport ICAO code
  route?: string;        // origin -> destination display string
}

export interface FlightState {
  allFlights: Flight[];
  approachingFlights: Flight[];
  buitenveldertbaanActive: boolean;
  lastUpdateMs: number;
  weather?: import('@/lib/api/weather').MetarData | null;
  runwayPredictions?: RunwayPrediction[];
}

export interface VisibilityPrediction {
  flightId: string;
  callsign: string;
  aircraftType: string | null;
  origin?: string;
  secondsUntilZoneEntry: number;
  predictedEntryTime: number;
  predictedAltitudeAtEntry: number;
  predictedVisibility: 'visible' | 'partially_visible' | 'obscured';
  currentDistanceKm: number;
  currentAltitude: number;
  minutesToLanding: number;
  confidence: 'high' | 'medium' | 'low';
  updatedAt: number;
}

export type RunwayDirection = '09' | '27';

export interface RunwayPrediction {
  flightId: string;
  callsign: string;
  runway: RunwayDirection;
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  signals: {
    wind: number;
    history: number;
    timeOfDay: number;
    activeConfig: number;
  };
  updatedAt: number;
}

export type StateChangeEvent =
  | { type: 'flights_updated'; state: FlightState }
  | { type: 'buitenveldertbaan_activated'; flights: Flight[] }
  | { type: 'buitenveldertbaan_deactivated' }
  | { type: 'new_approach'; flight: Flight }
  | { type: 'runway_predictions'; predictions: RunwayPrediction[] }
  | { type: 'visibility_predictions'; predictions: VisibilityPrediction[] };
