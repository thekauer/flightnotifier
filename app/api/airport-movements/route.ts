import { NextResponse } from 'next/server';
import {
  getAirportMovements,
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

  try {
    const payload = await getAirportMovements({
      airportIdent,
      date,
      movement,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[airport-movements] Failed to fetch airport movements:', error);
    return NextResponse.json({ error: 'Failed to fetch airport movements' }, { status: 500 });
  }
}
