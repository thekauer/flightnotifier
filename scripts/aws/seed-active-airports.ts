/**
 * One-time seed script: writes the 20 permanent airports into DynamoDB.
 * Permanent airports have no `ttl` attribute — DynamoDB never expires them.
 *
 * Usage:
 *   DYNAMODB_TABLE_ACTIVE_AIRPORTS=<table-name> bun run scripts/aws/seed-active-airports.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE_ACTIVE_AIRPORTS;
if (!TABLE_NAME) {
  console.error('DYNAMODB_TABLE_ACTIVE_AIRPORTS is not set');
  process.exit(1);
}

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'eu-central-1',
});
const docClient = DynamoDBDocumentClient.from(client);

const permanentAirports = [
  { ident: 'EHAM', iata: 'AMS', name: 'Amsterdam Airport Schiphol', latitude: 52.308601, longitude: 4.76389 },
  { ident: 'LHBP', iata: 'BUD', name: 'Budapest Liszt Ferenc International Airport', latitude: 47.43018, longitude: 19.262393 },
  { ident: 'KATL', iata: 'ATL', name: 'Hartsfield Jackson Atlanta International Airport', latitude: 33.6367, longitude: -84.428101 },
  { ident: 'OMDB', iata: 'DXB', name: 'Dubai International Airport', latitude: 25.24979, longitude: 55.370992 },
  { ident: 'KDFW', iata: 'DFW', name: 'Dallas Fort Worth International Airport', latitude: 32.896801, longitude: -97.038002 },
  { ident: 'RJTT', iata: 'HND', name: 'Tokyo Haneda International Airport', latitude: 35.549678, longitude: 139.786958 },
  { ident: 'EGLL', iata: 'LHR', name: 'London Heathrow Airport', latitude: 51.470748, longitude: -0.459909 },
  { ident: 'KDEN', iata: 'DEN', name: 'Denver International Airport', latitude: 39.860027, longitude: -104.673792 },
  { ident: 'LTFM', iata: 'IST', name: 'Istanbul Airport', latitude: 41.274874, longitude: 28.732136 },
  { ident: 'KORD', iata: 'ORD', name: "Chicago O'Hare International Airport", latitude: 41.9786, longitude: -87.9048 },
  { ident: 'VIDP', iata: 'DEL', name: 'Indira Gandhi International Airport', latitude: 28.55563, longitude: 77.09519 },
  { ident: 'ZSPD', iata: 'PVG', name: 'Shanghai Pudong International Airport', latitude: 31.1434, longitude: 121.805 },
  { ident: 'KLAX', iata: 'LAX', name: 'Los Angeles International Airport', latitude: 33.942501, longitude: -118.407997 },
  { ident: 'ZGGG', iata: 'CAN', name: 'Guangzhou Baiyun International Airport', latitude: 23.392401, longitude: 113.299004 },
  { ident: 'RKSI', iata: 'ICN', name: 'Incheon International Airport', latitude: 37.469101, longitude: 126.450996 },
  { ident: 'LFPG', iata: 'CDG', name: 'Charles de Gaulle International Airport', latitude: 49.00896, longitude: 2.554117 },
  { ident: 'WSSS', iata: 'SIN', name: 'Singapore Changi Airport', latitude: 1.35019, longitude: 103.994003 },
  { ident: 'ZBAA', iata: 'PEK', name: 'Beijing Capital International Airport', latitude: 40.077349, longitude: 116.596702 },
  { ident: 'LEMD', iata: 'MAD', name: 'Adolfo Suarez Madrid-Barajas Airport', latitude: 40.493407, longitude: -3.572249 },
  { ident: 'KJFK', iata: 'JFK', name: 'John F. Kennedy International Airport', latitude: 40.639447, longitude: -73.779317 },
  { ident: 'VTBS', iata: 'BKK', name: 'Suvarnabhumi Airport', latitude: 13.6811, longitude: 100.747002 },
] as const;

async function seed() {
  console.log(`Seeding ${permanentAirports.length} permanent airports into ${TABLE_NAME}...`);

  for (const airport of permanentAirports) {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          airport_ident: airport.ident,
          iata: airport.iata,
          name: airport.name,
          latitude: airport.latitude,
          longitude: airport.longitude,
          touched_at: new Date().toISOString(),
          // No `ttl` — permanent airports never expire
        },
      }),
    );
    console.log(`  ✓ ${airport.ident} (${airport.iata}) — ${airport.name}`);
  }

  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
