import { NextResponse } from 'next/server';
import { getDbSchedule } from '@/server/http/services/dbStateService';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

function parseHorizonMinutes(raw: string | null): number | null {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return null;
  return n;
}

export async function handleDbScheduleGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const horizonMinutes = parseHorizonMinutes(url.searchParams.get('horizon'));
  const airportIdent = url.searchParams.get('airport')?.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  return NextResponse.json(await getDbSchedule(horizonMinutes, airportIdent));
}
