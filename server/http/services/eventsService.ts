import type { MetarData } from '@/lib/api/weather';
import type { FlightState, StateChangeEvent } from '@/server/state';
import {
  decrementSSEClients,
  incrementSSEClients,
  type WeatherCache,
} from '@/server/singleton';
import type { ZoneBounds, VisibilityPrediction } from '@/server/visibility/types';
import { predictAll } from '@/server/visibility/predictor';
import { getScheduleForRequest } from '@/server/http/services/scheduleService';

const SCHEDULE_EVENTS_INTERVAL_MS = 30_000;
const WEATHER_EVENTS_INTERVAL_MS = 60_000;

export function parseZoneBounds(url: URL): ZoneBounds | null {
  const south = parseFloat(url.searchParams.get('south') ?? '');
  const west = parseFloat(url.searchParams.get('west') ?? '');
  const north = parseFloat(url.searchParams.get('north') ?? '');
  const east = parseFloat(url.searchParams.get('east') ?? '');

  if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) {
    return null;
  }

  if (south >= north || west >= east) {
    return null;
  }

  return { south, west, north, east };
}

function buildFlightsUpdatedEvent(state: FlightState, weather: MetarData | null): StateChangeEvent {
  return {
    type: 'flights_updated',
    state: {
      ...state,
      weather,
    },
  };
}

function buildVisibilityEvent(
  state: FlightState,
  zoneBounds: ZoneBounds,
  weather: MetarData | null,
): StateChangeEvent {
  const predictions: VisibilityPrediction[] = predictAll(
    state.approachingFlights,
    zoneBounds,
    weather,
  );

  return {
    type: 'visibility_predictions',
    predictions,
  };
}

async function buildScheduleEvent(state: FlightState): Promise<StateChangeEvent> {
  return {
    type: 'schedule_updated',
    schedule: await getScheduleForRequest(state, null),
    fetchedAt: Date.now(),
  };
}

function buildWeatherEvent(weather: MetarData | null): StateChangeEvent {
  return {
    type: 'weather_updated',
    weather,
    fetchedAt: Date.now(),
  };
}

export function createStateEventsStream({
  stateManager,
  weatherCache,
  zoneBounds,
}: {
  stateManager: {
    getState(): FlightState;
    onEvent(callback: (event: StateChangeEvent) => void): () => void;
  };
  weatherCache: WeatherCache;
  zoneBounds: ZoneBounds | null;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let scheduleInterval: ReturnType<typeof setInterval> | null = null;
  let weatherInterval: ReturnType<typeof setInterval> | null = null;
  let lastScheduleSnapshot: string | null = null;
  let lastWeatherSnapshot: string | null = null;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      incrementSSEClients();

      try {
        const enqueue = (event: StateChangeEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        const emitSchedule = async () => {
          const event = await buildScheduleEvent(stateManager.getState());
          const snapshot = JSON.stringify(event.schedule);
          if (snapshot === lastScheduleSnapshot) {
            return;
          }

          lastScheduleSnapshot = snapshot;
          enqueue(event);
        };

        const emitWeather = async () => {
          const weather = await weatherCache.get();
          const event = buildWeatherEvent(weather);
          const snapshot = JSON.stringify(weather);
          if (snapshot === lastWeatherSnapshot) {
            return;
          }

          lastWeatherSnapshot = snapshot;
          enqueue(event);
        };

        const currentState = stateManager.getState();
        const weather = weatherCache.getCached();

        enqueue(buildFlightsUpdatedEvent(currentState, weather));

        if (currentState.runwayPredictions && currentState.runwayPredictions.length > 0) {
          enqueue({
            type: 'runway_predictions',
            predictions: currentState.runwayPredictions,
          });
        }

        if (zoneBounds) {
          enqueue(buildVisibilityEvent(currentState, zoneBounds, weather));
        }

        if (weather !== undefined) {
          const initialWeatherEvent = buildWeatherEvent(weather);
          lastWeatherSnapshot = JSON.stringify(weather);
          enqueue(initialWeatherEvent);
        }

        void emitSchedule().catch((error) => {
          console.error('[events] Failed to emit initial schedule:', error);
        });

        scheduleInterval = setInterval(() => {
          void emitSchedule().catch((error) => {
            if (!closed) {
              console.error('[events] Failed to emit schedule update:', error);
            }
          });
        }, SCHEDULE_EVENTS_INTERVAL_MS);

        weatherInterval = setInterval(() => {
          void emitWeather().catch((error) => {
            if (!closed) {
              console.error('[events] Failed to emit weather update:', error);
            }
          });
        }, WEATHER_EVENTS_INTERVAL_MS);

        unsubscribe = stateManager.onEvent((event) => {
          try {
            if (event.type === 'flights_updated') {
              const currentWeather = weatherCache.getCached();
              enqueue(buildFlightsUpdatedEvent(event.state, currentWeather));

              if (zoneBounds) {
                enqueue(buildVisibilityEvent(event.state, zoneBounds, currentWeather));
              }

              void emitSchedule().catch((error) => {
                if (!closed) {
                  console.error('[events] Failed to emit schedule update:', error);
                }
              });

              return;
            }

            enqueue(event);
          } catch {
            // Client disconnected; the stream cancellation path handles cleanup.
          }
        });
      } catch (error) {
        decrementSSEClients();
        unsubscribe?.();
        throw error;
      }
    },
    cancel() {
      closed = true;
      decrementSSEClients();
      unsubscribe?.();
      if (scheduleInterval) clearInterval(scheduleInterval);
      if (weatherInterval) clearInterval(weatherInterval);
    },
  });
}
