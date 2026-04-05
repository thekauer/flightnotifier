import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, activeAirportsTableName } from '@/server/lib/dynamodb';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

const ACTIVE_AIRPORT_TTL_SECONDS = 5 * 60;

export const ACTIVE_AIRPORT_WINDOW_MS = ACTIVE_AIRPORT_TTL_SECONDS * 1000;

export async function touchActiveAirport(
  airport: Pick<AirportSearchRecord, 'ident' | 'iata' | 'name' | 'latitude' | 'longitude'>,
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + ACTIVE_AIRPORT_TTL_SECONDS;

  await docClient.send(
    new PutCommand({
      TableName: activeAirportsTableName(),
      Item: {
        airport_ident: airport.ident,
        iata: airport.iata ?? null,
        name: airport.name,
        latitude: airport.latitude,
        longitude: airport.longitude,
        touched_at: new Date().toISOString(),
        ttl,
      },
    }),
  );
}

export interface ActiveAirportRecord {
  airportIdent: string;
  iata: string | null;
  name: string;
  latitude: number;
  longitude: number;
  touchedAt: Date;
}

export async function getActiveAirports(): Promise<ActiveAirportRecord[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: activeAirportsTableName(),
    }),
  );

  return (result.Items ?? []).map((item) => ({
    airportIdent: item['airport_ident'] as string,
    iata: (item['iata'] as string | null) ?? null,
    name: item['name'] as string,
    latitude: item['latitude'] as number,
    longitude: item['longitude'] as number,
    touchedAt: new Date(item['touched_at'] as string),
  }));
}

export async function getActiveAirportIdents(): Promise<string[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: activeAirportsTableName(),
      ProjectionExpression: 'airport_ident',
    }),
  );

  return (result.Items ?? []).map((item) => item['airport_ident'] as string);
}

export async function getActiveAirportTouchedAt(airportIdent: string): Promise<Date | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: activeAirportsTableName(),
      Key: { airport_ident: airportIdent },
      ProjectionExpression: 'touched_at',
    }),
  );

  if (!result.Item) return null;
  return new Date(result.Item['touched_at'] as string);
}
