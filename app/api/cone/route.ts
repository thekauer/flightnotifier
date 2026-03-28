import { handleConeGet } from '@/server/http/controllers/coneController';

export function GET() {
  return handleConeGet();
}
