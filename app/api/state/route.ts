import { handleDbStateGet } from '@/server/http/controllers/dbStateController';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleDbStateGet();
}
