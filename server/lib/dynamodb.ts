import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'eu-central-1',
});

export const docClient = DynamoDBDocumentClient.from(client);

export function activeAirportsTableName(): string {
  const name = process.env.DYNAMODB_TABLE_ACTIVE_AIRPORTS;
  if (!name) {
    throw new Error('DYNAMODB_TABLE_ACTIVE_AIRPORTS is not set');
  }
  return name;
}
