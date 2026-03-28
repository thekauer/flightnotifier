import { NextResponse } from 'next/server';
import { getStateManager, getPoller } from '@/server/singleton';
import { getScheduleForRequest } from '@/server/http/services/scheduleService';

function parseHorizonMinutes(raw: string | null): number | null {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return null;
  return n;
}

export async function handleScheduleGet(request: Request): Promise<Response> {
  getPoller();
  const state = getStateManager().getState();
  const url = new URL(request.url);
  const horizonMinutes = parseHorizonMinutes(url.searchParams.get('horizon'));

  const schedule = await getScheduleForRequest(state, horizonMinutes);
  return NextResponse.json(schedule);
}
