import { NextResponse } from 'next/server';
import { APPROACH_CONE_27, RWY27_THRESHOLD } from '@/server/opensky/detector';

export function GET() {
  return NextResponse.json({
    cone27: APPROACH_CONE_27,
    threshold27: RWY27_THRESHOLD,
    // Keep legacy fields for backward compatibility
    cone: APPROACH_CONE_27,
    threshold: RWY27_THRESHOLD,
  });
}
