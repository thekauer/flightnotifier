import { NextResponse } from 'next/server';
import { getPoller, getStateManager, getWeatherCache } from '@/server/singleton';
import { buildStateResponse } from '@/server/http/services/stateService';

export function handleStateGet(): Response {
  getPoller();

  const state = getStateManager().getState();
  const weather = getWeatherCache().getCached();

  return NextResponse.json(buildStateResponse(state, weather));
}
