'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightState, StateChangeEvent, Flight, VisibilityPrediction, RunwayPrediction } from '@/lib/types';
import { useAircraftFilter } from '@/lib/aircraftFilterContext';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useVisibilitySettings } from '@/lib/visibilitySettingsContext';
import {
  requestBrowserNotificationPermission,
  showAppNotification,
} from '@/lib/notifications';
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
  if (flights.length === 0) return;
  void showAppNotification('Buitenveldertbaan Active!', {
    body: `${flights.length} flight(s) approaching`,
    tag: 'buitenveldertbaan-active',
  });
}

function notifyNewApproach(flight: Flight): void {
  const label = flight.callsign || flight.id;
  const type = flight.aircraftType || '?';
  void showAppNotification(`New Approach: ${label}`, {
    body: `${label} (${type}) at ${flight.alt}ft`,
    tag: `approach-${flight.id}`,
  });
}

function notifyZoneEntry(flight: Flight): void {
  const label = flight.callsign || flight.id;
  const type = flight.aircraftType || '?';
  void showAppNotification(`Entered Blue Zone: ${label}`, {
    body: `${label} (${type}) is now inside your notification zone`,
    tag: `zone-entry-${flight.id}-${Date.now()}`,
  });
}

export function useFlightEvents() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const connectedRef = useRef(false);
  const { isTypeEnabled } = useAircraftFilter();
  const { zone } = useNotificationZone();
  const { settings: visibilitySettings } = useVisibilitySettings();
  const visibilitySettingsRef = useRef(visibilitySettings);
  const isTypeEnabledRef = useRef(isTypeEnabled);
  const zoneRef = useRef(zone);
  const zoneFlightIdsRef = useRef<Set<string>>(new Set());
  const hasPrimedZoneEntriesRef = useRef(false);

  // Keep refs in sync so the useEffect dependency triggers reconnection
  zoneRef.current = zone;
  visibilitySettingsRef.current = visibilitySettings;
  isTypeEnabledRef.current = isTypeEnabled;

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

    zoneFlightIdsRef.current = new Set();
    hasPrimedZoneEntriesRef.current = false;

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
          case 'flights_updated': {
            const currentZone = zoneRef.current;
            if (currentZone) {
              const currentZoneFlights = parsed.state.allFlights.filter(
                (flight) =>
                  !flight.onGround &&
                  flight.lat >= currentZone.south &&
                  flight.lat <= currentZone.north &&
                  flight.lon >= currentZone.west &&
                  flight.lon <= currentZone.east,
              );
              const currentZoneIds = new Set(currentZoneFlights.map((flight) => flight.id));

              if (hasPrimedZoneEntriesRef.current) {
                for (const flight of currentZoneFlights) {
                  if (
                    !zoneFlightIdsRef.current.has(flight.id) &&
                    isTypeEnabledRef.current(flight.aircraftType)
                  ) {
                    notifyZoneEntry(flight);
                  }
                }
              } else {
                hasPrimedZoneEntriesRef.current = true;
              }

              zoneFlightIdsRef.current = currentZoneIds;
            } else {
              zoneFlightIdsRef.current = new Set();
              hasPrimedZoneEntriesRef.current = false;
            }

            queryClient.setQueryData<FlightState>(FLIGHT_STATE_KEY, parsed.state);
            break;
          }
          case 'buitenveldertbaan_activated':
            notifyBuitenveldertbaan(
              parsed.flights.filter((flight) => isTypeEnabledRef.current(flight.aircraftType)),
            );
            break;
          case 'new_approach':
            if (isTypeEnabledRef.current(parsed.flight.aircraftType)) {
              notifyNewApproach(parsed.flight);
            }
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
      void requestBrowserNotificationPermission();
    }
  }, []);

  return { state, connected, requestNotificationPermission };
}
