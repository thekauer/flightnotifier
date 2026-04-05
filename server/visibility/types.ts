import type { VisibilityLevel } from '@/lib/api/weather';
import type { ZoneBounds } from '@/lib/geoBounds';

export type { ZoneBounds } from '@/lib/geoBounds';

export interface VisibilityPrediction {
  flightId: string;
  callsign: string;
  aircraftType: string | null;
  origin?: string;
  secondsUntilZoneEntry: number;
  predictedEntryTime: number;        // unix ms
  predictedAltitudeAtEntry: number;  // feet
  predictedVisibility: 'visible' | 'partially_visible' | 'obscured';
  currentDistanceKm: number;
  currentAltitude: number;
  minutesToLanding: number;
  confidence: 'high' | 'medium' | 'low';
  updatedAt: number;
}

/** Maps VisibilityLevel from weather module to prediction visibility */
export function mapVisibilityLevel(level: VisibilityLevel): VisibilityPrediction['predictedVisibility'] {
  switch (level) {
    case 'clear': return 'visible';
    case 'partial': return 'partially_visible';
    case 'obscured': return 'obscured';
  }
}
