import { handleEventsGet } from '@/server/http/controllers/eventsController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleEventsGet(request);
}
