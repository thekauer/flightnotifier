import { NextResponse } from 'next/server';
import { getPoller, getStateManager, getWeatherCache } from '@/server/singleton';
import { parseZoneBounds } from '@/server/http/services/eventsService';
import { getVisibilityPredictions } from '@/server/http/services/visibilityPredictionsService';

export async function handleVisibilityPredictionsGet(request: Request): Promise<Response> {
  getPoller();

  const zoneBounds = parseZoneBounds(new URL(request.url));
  if (!zoneBounds) {
    return NextResponse.json(
      { error: 'Missing or invalid south, west, north, east query parameters' },
      { status: 400 },
    );
  }

  const state = getStateManager().getState();
  const weather = await getWeatherCache().get().catch(() => getWeatherCache().getCached());

  return NextResponse.json(getVisibilityPredictions(state, zoneBounds, weather));
}
