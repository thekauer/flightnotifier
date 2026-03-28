'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightState, StateChangeEvent, Flight, VisibilityPrediction, RunwayPrediction } from '@/lib/types';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useVisibilitySettings } from '@/lib/visibilitySettingsContext';
import { SCHEDULE_KEY } from './useScheduleData';
import { PREDICTIONS_KEY } from './useVisibilityPredictions';

const INITIAL_STATE: FlightState = {
  allFlights: [],
  approachingFlights: [],
  buitenveldertbaanActive: false,
  lastUpdateMs: 0,
};

const FLIGHT_STATE_KEY = ['flightState'] as const;
export const RUNWAY_PREDICTIONS_KEY = ['runwayPredictions'] as const;
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

export function useFlightEvents() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const { zone } = useNotificationZone();
  const { settings: visibilitySettings } = useVisibilitySettings();
  const visibilitySettingsRef = useRef(visibilitySettings);
  const zoneRef = useRef(zone);

  // Keep refs in sync so the useEffect dependency triggers reconnection
  zoneRef.current = zone;
  visibilitySettingsRef.current = visibilitySettings;

  // Backend SSE mode — zone is included in deps so the stream reconnects with fresh bounds.
  useEffect(() => {
    // Build URL with optional zone bounds
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
    } else {
      queryClient.setQueryData<VisibilityPrediction[]>(PREDICTIONS_KEY, []);
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
              ? parsed.predictions.filter((p: VisibilityPrediction) => {
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
          case 'schedule_updated':
            queryClient.setQueryData(SCHEDULE_KEY, parsed.schedule);
            break;
          case 'weather_updated':
            queryClient.setQueryData<FlightState>(FLIGHT_STATE_KEY, (current) => {
              if (!current) {
                return {
                  ...INITIAL_STATE,
                  weather: parsed.weather ?? null,
                };
              }

              return {
                ...current,
                weather: parsed.weather ?? null,
              };
            });
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      es.close();
    };
  }, [queryClient, zone]);

  const { data: state = INITIAL_STATE } = useQuery<FlightState>({
    queryKey: FLIGHT_STATE_KEY,
    queryFn: async () => {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to fetch flight state');
      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Bootstrap from /api/state while SSE connects.
    enabled: !connectedRef.current,
  });

  const requestNotificationPermission = useCallback(() => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission();
    }
  }, []);

  return { state, connected, requestNotificationPermission };
}
