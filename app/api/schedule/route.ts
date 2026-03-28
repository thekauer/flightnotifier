import { NextResponse } from 'next/server';
import { getStateManager, getPoller } from '@/server/singleton';
import { buildSchedule } from '@/server/opensky/schedule';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  getPoller(); // ensure poller is started
  const state = getStateManager().getState();
  const approachingIds = new Set(state.approachingFlights.map((f) => f.id));

  // Parse optional horizon parameter (minutes, default: no filter)
  const url = new URL(request.url);
  const horizonParam = url.searchParams.get('horizon');
  const horizonMinutes = horizonParam ? parseInt(horizonParam, 10) : null;

  let schedule = buildSchedule(state.allFlights, approachingIds);

  // Filter by horizon if provided and valid
  if (horizonMinutes !== null && !isNaN(horizonMinutes) && horizonMinutes > 0) {
    const clampedHorizon = Math.min(Math.max(horizonMinutes, 1), 1440);
    schedule = schedule.filter((a) => a.estimatedMinutes <= clampedHorizon);
  }

  return NextResponse.json(schedule);
}
