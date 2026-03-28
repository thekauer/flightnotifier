import { handleRunwayPredictionsGet } from '@/server/http/controllers/runwayPredictionsController';

export const dynamic = 'force-dynamic';

export function GET() {
  return handleRunwayPredictionsGet();
}
