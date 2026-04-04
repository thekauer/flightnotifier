import { createDbEventsStream, parseZoneBounds } from '@/server/http/services/dbEventsService';

export async function handleDbEventsGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const stream = createDbEventsStream(parseZoneBounds(url));

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
