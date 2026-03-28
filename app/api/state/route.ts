import { NextResponse } from 'next/server';
import { getStateManager, getPoller } from '@/server/singleton';

export const dynamic = 'force-dynamic';

export function GET() {
  getPoller(); // ensure poller is started
  return NextResponse.json(getStateManager().getState());
}
