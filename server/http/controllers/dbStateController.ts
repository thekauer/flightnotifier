import { NextResponse } from 'next/server';
import { getDbState } from '@/server/http/services/dbStateService';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

export async function handleDbStateGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const airportIdent = url.searchParams.get('airport')?.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  return NextResponse.json(await getDbState(airportIdent));
}
