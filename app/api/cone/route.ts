import { NextResponse } from 'next/server';
import { APPROACH_CONE, RWY27_THRESHOLD } from '@/server/opensky/detector';

export function GET() {
  return NextResponse.json({ cone: APPROACH_CONE, threshold: RWY27_THRESHOLD });
}
