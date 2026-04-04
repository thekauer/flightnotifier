import { NextResponse } from 'next/server';
import { getDbFlightHistory } from '@/server/http/services/dbFlightHistoryService';

export async function handleDbFlightHistoryGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const callsign = url.searchParams.get('callsign')?.trim();
  const origin = url.searchParams.get('origin')?.trim() || undefined;
  const destination = url.searchParams.get('destination')?.trim() || undefined;

  if (!callsign) {
    return NextResponse.json({ error: 'Missing callsign parameter' }, { status: 400 });
  }

  try {
    const history = await getDbFlightHistory({
      callsign,
      origin,
      destination,
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error('[db-flight-history] Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch flight history' }, { status: 500 });
  }
}
