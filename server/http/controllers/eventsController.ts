import {
  getPoller,
  getStateManager,
  getWeatherCache,
} from '@/server/singleton';
import {
  createStateEventsStream,
  parseZoneBounds,
} from '@/server/http/services/eventsService';

export async function handleEventsGet(request: Request): Promise<Response> {
  getPoller();

  const url = new URL(request.url);
  const stream = createStateEventsStream({
    stateManager: getStateManager(),
    weatherCache: getWeatherCache(),
    zoneBounds: parseZoneBounds(url),
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
