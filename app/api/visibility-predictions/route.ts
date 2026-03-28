import { handleVisibilityPredictionsGet } from '@/server/http/controllers/visibilityPredictionsController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleVisibilityPredictionsGet(request);
}
