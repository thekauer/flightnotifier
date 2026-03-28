import { handleFlightHistoryGet } from '@/server/http/controllers/flightHistoryController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleFlightHistoryGet(request);
}
