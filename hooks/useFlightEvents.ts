'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightState, StateChangeEvent, Flight, VisibilityPrediction, RunwayPrediction } from '@/lib/types';
import { fetchStateVectors, OpenSkyHttpError } from '@/lib/api/opensky';
import { fetchMetar } from '@/lib/api/weather';
import { useDataSource } from '@/lib/dataSourceContext';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useVisibilitySettings } from '@/lib/visibilitySettingsContext';
import { PREDICTIONS_KEY } from './useVisibilityPredictions';

const INITIAL_STATE: FlightState = {
  allFlights: [],
  approachingFlights: [],
  buitenveldertbaanActive: false,
  lastUpdateMs: 0,
};

const FLIGHT_STATE_KEY = ['flightState'] as const;
export const RUNWAY_PREDICTIONS_KEY = ['runwayPredictions'] as const;
const FALLBACK_POLL_INTERVAL_MS = 90_000;
const FALLBACK_RATE_LIMIT_BACKOFF_MS = 5 * 60_000;

// Schiphol approach bounding box (same as server)
const APPROACH_BOUNDS = { lamin: 52.2, lomin: 4.6, lamax: 52.45, lomax: 5.1 };

function notifyBuitenveldertbaan(flights: Flight[]): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification('Buitenveldertbaan Active!', {
    body: `${flights.length} flight(s) approaching`,
    icon: '/favicon.ico',
  });
}

function notifyNewApproach(flight: Flight): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const label = flight.callsign || flight.id;
  const type = flight.aircraftType || '?';
  new Notification(`New Approach: ${label}`, {
    body: `${label} (${type}) at ${flight.alt}ft`,
    icon: '/favicon.ico',
  });
}

async function fetchOpenSkyDirect(): Promise<Flight[]> {
  return fetchStateVectors(APPROACH_BOUNDS);
}

export function useFlightEvents() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const { dataSource } = useDataSource();
  const { zone } = useNotificationZone();
  const { settings: visibilitySettings } = useVisibilitySettings();
  const visibilitySettingsRef = useRef(visibilitySettings);
  const zoneRef = useRef(zone);

  // Keep refs in sync so the useEffect dependency triggers reconnection
  zoneRef.current = zone;
  visibilitySettingsRef.current = visibilitySettings;

  // Existing useEffect: manages SSE connection in backend mode,
  // or direct polling in fallback mode.
  // NOTE(predictive-visibility): zone is included in deps so SSE reconnects
  // when the user draws/clears a notification zone, passing bounds as query params.
  useEffect(() => {
    if (dataSource === 'fallback') {
      // Direct polling mode -- poll OpenSky much less aggressively.
      let cancelled = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      connectedRef.current = false;
      setConnected(false);

      const scheduleNext = (delayMs: number) => {
        if (cancelled) return;
        timeoutId = setTimeout(() => {
          void poll();
        }, delayMs);
      };

      const poll = async () => {
        let nextDelayMs = FALLBACK_POLL_INTERVAL_MS;
        try {
          const [flights, weather] = await Promise.all([
            fetchOpenSkyDirect(),
            fetchMetar('EHAM').catch(() => null),
          ]);
          if (cancelled) return;
          const state: FlightState = {
            allFlights: flights,
            approachingFlights: [], // no server-side detection in fallback
            buitenveldertbaanActive: false,
            lastUpdateMs: Date.now(),
            weather,
          };
          queryClient.setQueryData<FlightState>(FLIGHT_STATE_KEY, state);
          setConnected(true);
          connectedRef.current = true;
        } catch (error) {
          if (error instanceof OpenSkyHttpError && error.status === 429) {
            nextDelayMs = Math.max(
              (error.retryAfterSeconds ?? 0) * 1000,
              FALLBACK_RATE_LIMIT_BACKOFF_MS,
            );
          }
          setConnected(false);
          connectedRef.current = false;
        }

        scheduleNext(nextDelayMs);
      };

      scheduleNext(0);

      return () => {
        cancelled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }

    // Backend SSE mode — build URL with optional zone bounds
    let sseUrl = '/api/events';
    const currentZone = zoneRef.current;
    if (currentZone) {
      const params = new URLSearchParams({
        south: String(currentZone.south),
        west: String(currentZone.west),
        north: String(currentZone.north),
        east: String(currentZone.east),
      });
      sseUrl = `/api/events?${params.toString()}`;
    }

    const es = new EventSource(sseUrl);

    es.onopen = () => {
      connectedRef.current = true;
      setConnected(true);
    };

    es.onerror = () => {
      connectedRef.current = false;
      setConnected(false);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as StateChangeEvent;
        switch (parsed.type) {
          case 'flights_updated':
            queryClient.setQueryData<FlightState>(FLIGHT_STATE_KEY, parsed.state);
            break;
          case 'buitenveldertbaan_activated':
            notifyBuitenveldertbaan(parsed.flights);
            break;
          case 'new_approach':
            notifyNewApproach(parsed.flight);
            break;
          case 'buitenveldertbaan_deactivated':
            break;
          case 'runway_predictions':
            queryClient.setQueryData<RunwayPrediction[]>(
              RUNWAY_PREDICTIONS_KEY,
              parsed.predictions,
            );
            break;
          case 'visibility_predictions': {
            const vs = visibilitySettingsRef.current;
            const filtered = vs.predictionEnabled
              ? parsed.predictions.filter((p) => {
                  if (p.predictedVisibility === 'visible') return true;
                  if (p.predictedVisibility === 'partially_visible') return vs.notifyPartialVisibility;
                  if (p.predictedVisibility === 'obscured') return vs.notifyObscured;
                  return true;
                })
              : [];
            queryClient.setQueryData<VisibilityPrediction[]>(
              PREDICTIONS_KEY,
              filtered,
            );
            break;
          }
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      es.close();
    };
  }, [queryClient, dataSource, zone]);

  const { data: state = INITIAL_STATE } = useQuery<FlightState>({
    queryKey: FLIGHT_STATE_KEY,
    queryFn: async () => {
      if (dataSource === 'fallback') {
        const [flights, weather] = await Promise.all([
          fetchOpenSkyDirect(),
          fetchMetar('EHAM').catch(() => null),
        ]);
        return {
          allFlights: flights,
          approachingFlights: [],
          buitenveldertbaanActive: false,
          lastUpdateMs: Date.now(),
          weather,
        };
      }
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to fetch flight state');
      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Backend mode can bootstrap from /api/state while SSE connects.
    // In fallback mode the polling effect already owns OpenSky fetching.
    enabled: dataSource !== 'fallback' && !connectedRef.current,
  });

  const requestNotificationPermission = useCallback(() => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission();
    }
  }, []);

  return { state, connected, requestNotificationPermission };
}
