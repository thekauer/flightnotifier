import airportAreaConfig from '@/cron/internal/shared/airport-area.json';
import type { ZoneBounds } from '@/lib/geoBounds';

interface AirportCoordinates {
  latitude: number;
  longitude: number;
}

const AIRPORT_AREA_OFFSET = {
  south: airportAreaConfig.referenceAirport.latitude - airportAreaConfig.referenceBounds.south,
  west: airportAreaConfig.referenceAirport.longitude - airportAreaConfig.referenceBounds.west,
  north: airportAreaConfig.referenceBounds.north - airportAreaConfig.referenceAirport.latitude,
  east: airportAreaConfig.referenceBounds.east - airportAreaConfig.referenceAirport.longitude,
} as const;

export function getAirportAreaBounds(airport: AirportCoordinates): ZoneBounds {
  return {
    south: airport.latitude - AIRPORT_AREA_OFFSET.south,
    west: airport.longitude - AIRPORT_AREA_OFFSET.west,
    north: airport.latitude + AIRPORT_AREA_OFFSET.north,
    east: airport.longitude + AIRPORT_AREA_OFFSET.east,
  };
}
