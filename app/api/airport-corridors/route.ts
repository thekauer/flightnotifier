import { NextResponse } from 'next/server';
import {
  getAirportCorridors,
  resolveCorridorWindowMinutes,
} from '@/server/http/services/airportCorridorsService';
import {
  resolveAirportIdent,
  resolveAirportMovementsDate,
  resolveMovementFilter,
} from '@/server/http/services/airportMovementsService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const airportIdent = resolveAirportIdent(url.searchParams.get('airport'));
  const date = resolveAirportMovementsDate(url.searchParams.get('date'));
  const movement = resolveMovementFilter(url.searchParams.get('movement'));
  const windowMinutes = resolveCorridorWindowMinutes(url.searchParams.get('windowMinutes'));

  try {
    const payload = await getAirportCorridors({
      airportIdent,
      date,
      movement,
      windowMinutes,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[airport-corridors] Failed to fetch airport corridors:', error);
    return NextResponse.json({ error: 'Failed to fetch airport corridors' }, { status: 500 });
  }
}
