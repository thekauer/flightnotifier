import { handleDbStateGet } from '@/server/http/controllers/dbStateController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleDbStateGet(request);
}
