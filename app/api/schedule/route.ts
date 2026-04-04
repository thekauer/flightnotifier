import { handleDbScheduleGet } from '@/server/http/controllers/dbScheduleController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDbScheduleGet(request);
}
