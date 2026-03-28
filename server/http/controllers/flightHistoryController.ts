import { NextResponse } from 'next/server';
import { getFlightHistory } from '@/server/http/services/flightHistoryService';

export async function handleFlightHistoryGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const callsign = url.searchParams.get('callsign')?.trim();
  const origin = url.searchParams.get('origin')?.trim() || undefined;
  const destination = url.searchParams.get('destination')?.trim() || undefined;

  if (!callsign) {
    return NextResponse.json({ error: 'Missing callsign parameter' }, { status: 400 });
  }

  try {
    const history = await getFlightHistory({
      callsign,
      origin,
      destination,
    });
    return NextResponse.json(history);
  } catch (error) {
    console.error('[flight-history] Failed to fetch history:', error);
    return NextResponse.json({ error: 'Failed to fetch flight history' }, { status: 500 });
  }
}
