import { createDbEventsStream, parseZoneBounds } from '@/server/http/services/dbEventsService';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

export async function handleDbEventsGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const airportIdent = url.searchParams.get('airport')?.trim().toUpperCase() || DEFAULT_AIRPORT.ident;
  const stream = createDbEventsStream(parseZoneBounds(url), airportIdent);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
