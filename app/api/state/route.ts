import { NextResponse } from 'next/server';
import { getStateManager, getPoller, getWeatherCache } from '@/server/singleton';

export const dynamic = 'force-dynamic';

export function GET() {
  getPoller(); // ensure poller is started
  const state = getStateManager().getState();
  const weather = getWeatherCache().getCached();
  return NextResponse.json({ ...state, weather });
}
