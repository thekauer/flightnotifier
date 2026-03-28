import { NextResponse } from 'next/server';
import { getPoller, getStateManager } from '@/server/singleton';
import { getRunwayPredictions } from '@/server/http/services/runwayPredictionsService';

export function handleRunwayPredictionsGet(): Response {
  getPoller();
  const state = getStateManager().getState();
  return NextResponse.json(getRunwayPredictions(state));
}
