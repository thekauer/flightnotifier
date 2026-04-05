import type { AirportMovementFilter, AirportMovementType } from '@/lib/airportMovements';

export interface CorridorMatcherPoint {
  lat: number;
  lon: number;
}

export interface CorridorMatchCandidate {
  corridorId: string;
  movement: AirportMovementType;
  inferredRunway: string | null;
  weatherBucket: string;
  sampleCount: number;
  score: number;
  averageDistanceKm: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface CorridorMatchResult {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  observedPointCount: number;
  bestMatch: CorridorMatchCandidate | null;
  candidates: CorridorMatchCandidate[];
}
