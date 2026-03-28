import {
  getStateManager,
  getPoller,
  getWeatherCache,
  incrementSSEClients,
  decrementSSEClients,
} from '@/server/singleton';
import type { StateChangeEvent } from '@/server/state';
import type { ZoneBounds } from '@/server/visibility/types';
import { predictAll } from '@/server/visibility/predictor';

export const dynamic = 'force-dynamic';

/** Parse optional zone bounds from SSE query params */
function parseZoneBounds(url: URL): ZoneBounds | null {
  const south = parseFloat(url.searchParams.get('south') ?? '');
  const west = parseFloat(url.searchParams.get('west') ?? '');
  const north = parseFloat(url.searchParams.get('north') ?? '');
  const east = parseFloat(url.searchParams.get('east') ?? '');

  if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) return null;
  if (south >= north || west >= east) return null;
  return { south, west, north, east };
}

export async function GET(request: Request) {
  getPoller(); // ensure poller is started
  const stateManager = getStateManager();
  const weatherCache = getWeatherCache();

  const url = new URL(request.url);
  const zoneBounds = parseZoneBounds(url);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      incrementSSEClients();

      try {
        // Send current state immediately (with weather)
        const currentState = stateManager.getState();
        const weather = weatherCache.getCached();
        const initEvent: StateChangeEvent = {
          type: 'flights_updated',
          state: { ...currentState, weather },
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`));

        // Send initial runway predictions if available
        if (currentState.runwayPredictions && currentState.runwayPredictions.length > 0) {
          const rwPredEvent: StateChangeEvent = {
            type: 'runway_predictions',
            predictions: currentState.runwayPredictions,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(rwPredEvent)}\n\n`));
        }

        // If zone bounds provided, send initial visibility predictions
        if (zoneBounds) {
          const predictions = predictAll(currentState.approachingFlights, zoneBounds, weather);
          const predEvent: StateChangeEvent = {
            type: 'visibility_predictions',
            predictions,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(predEvent)}\n\n`));
        }

        // Subscribe to future events (attach weather to flight updates)
        unsubscribe = stateManager.onEvent((event) => {
          try {
            let enriched = event;
            if (event.type === 'flights_updated') {
              const currentWeather = weatherCache.getCached();
              enriched = {
                ...event,
                state: { ...event.state, weather: currentWeather },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(enriched)}\n\n`));

              // Emit visibility predictions alongside flight updates when zone is set
              if (zoneBounds) {
                const predictions = predictAll(
                  event.state.approachingFlights,
                  zoneBounds,
                  currentWeather,
                );
                const predEvent: StateChangeEvent = {
                  type: 'visibility_predictions',
                  predictions,
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(predEvent)}\n\n`));
              }
            } else {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(enriched)}\n\n`));
            }
          } catch {
            // Client disconnected
          }
        });
      } catch (err) {
        // If setup fails, ensure client count is decremented before re-throwing
        decrementSSEClients();
        unsubscribe?.();
        throw err;
      }
    },
    cancel() {
      decrementSSEClients();
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
