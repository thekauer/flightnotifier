import { handleHealthGet } from '@/server/http/controllers/healthController';

export function GET() {
  return handleHealthGet();
}
