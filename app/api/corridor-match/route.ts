import { NextResponse } from 'next/server';
import type { CorridorMatcherPoint } from '@/lib/corridorMatcher';
import { matchObservedPathToCorridors } from '@/server/http/services/corridorMatcherService';
import {
  resolveAirportIdent,
  resolveAirportMovementsDate,
  resolveMovementFilter,
} from '@/server/http/services/airportMovementsService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      airport?: string;
      date?: string;
      movement?: string;
      points?: CorridorMatcherPoint[];
    };

    const result = await matchObservedPathToCorridors({
      airportIdent: resolveAirportIdent(body.airport ?? null),
      date: resolveAirportMovementsDate(body.date ?? null),
      movement: resolveMovementFilter(body.movement ?? null),
      points: Array.isArray(body.points) ? body.points : [],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[corridor-match] Failed to match observed path:', error);
    return NextResponse.json({ error: 'Failed to match observed path' }, { status: 500 });
  }
}
