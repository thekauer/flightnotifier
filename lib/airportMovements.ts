export type AirportMovementType = 'arrival' | 'departure' | 'unknown';
export type AirportMovementFilter = AirportMovementType | 'all';
export type AirportMovementConfidence = 'high' | 'medium' | 'low';

export interface AirportRunwayGeometry {
  leIdent: string;
  heIdent: string;
  le: [number, number];
  he: [number, number];
}

export interface AirportMovementWeather {
  raw: string;
  station: string;
  observationTime: number;
  windDirection: number | null;
  windSpeed: number | null;
  windGust: number | null;
  visibility: number | null;
  ceiling: number | null;
  flightCategory: 'VFR' | 'MVFR' | 'IFR' | 'LIFR';
}

export interface AirportMovementTrackPoint {
  time: number;
  lat: number;
  lon: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
}

export interface AirportMovementTrack {
  icao24: string;
  callsign: string;
  origin: string | null;
  destination: string | null;
  firstSeen: number;
  lastSeen: number;
  pointCount: number;
  startsNearAirport: boolean;
  endsNearAirport: boolean;
  altitudeStart: number | null;
  altitudeEnd: number | null;
  altitudeDelta: number | null;
  movement: AirportMovementType;
  movementConfidence: AirportMovementConfidence;
  movementReason: string;
  inferredRunway: string | null;
  runwayConfidence: AirportMovementConfidence;
  weather: AirportMovementWeather | null;
  path: AirportMovementTrackPoint[];
}

export interface AirportMovementsPayload {
  airportIdent: string;
  airportName: string | null;
  airportLatitude: number;
  airportLongitude: number;
  date: string;
  timezone: string;
  movement: AirportMovementFilter;
  aircraftCount: number;
  pointCount: number;
  counts: {
    arrivals: number;
    departures: number;
    unknown: number;
  };
  runwayGeometry: AirportRunwayGeometry[];
  tracks: AirportMovementTrack[];
}
