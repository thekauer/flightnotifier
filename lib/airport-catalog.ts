export interface AirportSearchRecord {
  ident: string;
  iata: string | null;
  name: string;
  municipality: string | null;
  countryCode: string;
  country: string;
  latitude: number;
  longitude: number;
  type: string;
  scheduledService: boolean;
}
