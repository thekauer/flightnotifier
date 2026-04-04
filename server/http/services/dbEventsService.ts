import type { FlightState, StateChangeEvent } from '@/lib/types';
import type { ZoneBounds, VisibilityPrediction } from '@/server/visibility/types';
import { predictAll } from '@/server/visibility/predictor';
import { getDbSchedule, getDbState } from './dbStateService';

const STATE_EVENTS_INTERVAL_MS = 30_000;
const WEATHER_EVENTS_INTERVAL_MS = 60_000;
const SCHEDULE_EVENTS_INTERVAL_MS = 30_000;

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

function buildVisibilityEvent(state: FlightState, zoneBounds: ZoneBounds): StateChangeEvent {
  const predictions: VisibilityPrediction[] = predictAll(
    state.approachingFlights,
    zoneBounds,
    state.weather ?? null,
  );

  return {
    type: 'visibility_predictions',
    predictions,
  };
}

export function createDbEventsStream(zoneBounds: ZoneBounds | null, airportIdent: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let stateInterval: ReturnType<typeof setInterval> | null = null;
  let scheduleInterval: ReturnType<typeof setInterval> | null = null;
  let weatherInterval: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let lastStateSnapshot: string | null = null;
  let lastRunwaySnapshot: string | null = null;
  let lastWeatherSnapshot: string | null = null;
  let lastScheduleSnapshot: string | null = null;
  let previousApproachingIds = new Set<string>();
  let previousActive = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: StateChangeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const emitState = async () => {
        const state = await getDbState(airportIdent);
        const stateSnapshot = JSON.stringify(state);
        const runwaySnapshot = JSON.stringify(state.runwayPredictions ?? []);
        const weatherSnapshot = JSON.stringify(state.weather ?? null);

        if (stateSnapshot !== lastStateSnapshot) {
          enqueue({ type: 'flights_updated', state });

          const currentApproachingIds = new Set(state.approachingFlights.map((flight) => flight.id));
          if (!previousActive && state.buitenveldertbaanActive) {
            enqueue({ type: 'buitenveldertbaan_activated', flights: state.approachingFlights });
          } else if (previousActive && !state.buitenveldertbaanActive) {
            enqueue({ type: 'buitenveldertbaan_deactivated' });
          }

          for (const flight of state.approachingFlights) {
            if (!previousApproachingIds.has(flight.id)) {
              enqueue({ type: 'new_approach', flight });
            }
          }

          previousApproachingIds = currentApproachingIds;
          previousActive = state.buitenveldertbaanActive;
          lastStateSnapshot = stateSnapshot;

          if (zoneBounds) {
            enqueue(buildVisibilityEvent(state, zoneBounds));
          }
        }

        if (runwaySnapshot !== lastRunwaySnapshot && state.runwayPredictions) {
          enqueue({ type: 'runway_predictions', predictions: state.runwayPredictions });
          lastRunwaySnapshot = runwaySnapshot;
        }

        if (weatherSnapshot !== lastWeatherSnapshot) {
          enqueue({
            type: 'weather_updated',
            weather: state.weather ?? null,
            fetchedAt: Date.now(),
          });
          lastWeatherSnapshot = weatherSnapshot;
        }
      };

      const emitSchedule = async () => {
        const schedule = await getDbSchedule(null, airportIdent);
        const snapshot = JSON.stringify(schedule);
        if (snapshot === lastScheduleSnapshot) {
          return;
        }
        lastScheduleSnapshot = snapshot;
        enqueue({
          type: 'schedule_updated',
          schedule,
          fetchedAt: Date.now(),
        });
      };

      await emitState();
      await emitSchedule();

      stateInterval = setInterval(() => {
        void emitState().catch((error) => {
          if (!closed) {
            console.error('[db-events] Failed to emit state update:', error);
          }
        });
      }, STATE_EVENTS_INTERVAL_MS);

      scheduleInterval = setInterval(() => {
        void emitSchedule().catch((error) => {
          if (!closed) {
            console.error('[db-events] Failed to emit schedule update:', error);
          }
        });
      }, SCHEDULE_EVENTS_INTERVAL_MS);

      weatherInterval = setInterval(() => {
        void emitState().catch((error) => {
          if (!closed) {
            console.error('[db-events] Failed to emit weather update:', error);
          }
        });
      }, WEATHER_EVENTS_INTERVAL_MS);
    },
    cancel() {
      closed = true;
      if (stateInterval) clearInterval(stateInterval);
      if (scheduleInterval) clearInterval(scheduleInterval);
      if (weatherInterval) clearInterval(weatherInterval);
    },
  });
}
