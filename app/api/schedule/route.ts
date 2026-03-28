import { NextResponse } from 'next/server';
import { getStateManager, getPoller } from '@/server/singleton';
import { buildSchedule } from '@/server/opensky/schedule';

export const dynamic = 'force-dynamic';

export function GET() {
  getPoller(); // ensure poller is started
  const state = getStateManager().getState();
  const approachingIds = new Set(state.approachingFlights.map((f) => f.id));
  return NextResponse.json(buildSchedule(state.allFlights, approachingIds));
}
