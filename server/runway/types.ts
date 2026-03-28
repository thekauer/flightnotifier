export type RunwayDirection = '09' | '27';

export interface RunwayPrediction {
  flightId: string;
  callsign: string;
  runway: RunwayDirection;
  probability: number;          // 0..1
  confidence: 'high' | 'medium' | 'low';
  signals: {
    wind: number;               // 0..1 probability of RWY 27
    history: number;            // 0..1 probability of RWY 27
    timeOfDay: number;          // 0..1 probability of RWY 27
    activeConfig: number;       // 0..1 probability of RWY 27
  };
  updatedAt: number;            // unix ms
}

export interface RunwayHistoryEntry {
  callsign: string;             // normalized (trailing alpha stripped)
  runway: RunwayDirection;
  timestamp: number;            // unix ms
  heading: number;
  lat: number;
  lon: number;
}

export interface ArrivalRecord {
  icao24: string;
  callsign: string;
  firstSeen: number;
  lastSeen: number;
  estDepartureAirport: string | null;
  estArrivalAirport: string | null;
}
