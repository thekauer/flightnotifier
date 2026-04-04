import { handleDbEventsGet } from '@/server/http/controllers/dbEventsController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDbEventsGet(request);
}
