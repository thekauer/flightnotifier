import type {
  AirportMovementFilter,
  AirportMovementType,
  AirportMovementWeather,
  AirportRunwayGeometry,
} from '@/lib/airportMovements';

export interface AirportCorridorPoint {
  lat: number;
  lon: number;
}

export interface AirportCorridor {
  id: string;
  movement: AirportMovementType;
  inferredRunway: string | null;
  weatherBucket: string;
  sampleCount: number;
  averagePath: AirportCorridorPoint[];
  sampleCallsigns: string[];
  firstSeen: number;
  lastSeen: number;
}

export interface AirportCorridorsPayload {
  airportIdent: string;
  airportName: string | null;
  airportLatitude: number;
  airportLongitude: number;
  date: string;
  timezone: string;
  movement: AirportMovementFilter;
  windowMinutes: number;
  corridorCount: number;
  sourceTrackCount: number;
  weatherSamples: AirportMovementWeather[];
  runwayGeometry: AirportRunwayGeometry[];
  corridors: AirportCorridor[];
}
