import { handleStateGet } from '@/server/http/controllers/stateController';

export const dynamic = 'force-dynamic';

export function GET() {
  return handleStateGet();
}
