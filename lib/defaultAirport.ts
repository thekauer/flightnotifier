import type { AirportSearchRecord } from '@/lib/airport-catalog';

export const DEFAULT_AIRPORT: AirportSearchRecord = {
  ident: 'EHAM',
  iata: 'AMS',
  name: 'Amsterdam Airport Schiphol',
  municipality: 'Amsterdam',
  countryCode: 'NL',
  country: 'Netherlands',
  latitude: 52.3086013793945,
  longitude: 4.763889789581299,
  type: 'large_airport',
  scheduledService: true,
};

export function formatAirportSubtitle(airport: AirportSearchRecord): string {
  return [airport.municipality, airport.country].filter(Boolean).join(', ');
}

export function formatAirportCode(airport: AirportSearchRecord): string {
  return airport.iata ?? airport.ident;
}
