import { handleScheduleGet } from '@/server/http/controllers/scheduleController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleScheduleGet(request);
}
