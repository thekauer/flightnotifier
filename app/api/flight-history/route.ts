import { handleDbFlightHistoryGet } from '@/server/http/controllers/dbFlightHistoryController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDbFlightHistoryGet(request);
}
