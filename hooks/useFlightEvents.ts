'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightState, StateChangeEvent, Flight, VisibilityPrediction, RunwayPrediction } from '@/lib/types';
import { getAircraftImageFamilyId } from '@/lib/aircraftTypes';
import { useAircraftFilter } from '@/lib/aircraftFilterContext';
import { countryCodeToFlag, getAirportInfo } from '@/lib/airports';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useVisibilitySettings } from '@/lib/visibilitySettingsContext';
import {
  requestBrowserNotificationPermission,
  showAppNotification,
} from '@/lib/notifications';
import notificationPhotoManifest from '@/data/spotting/notification-photo-manifest.json';
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

interface NotificationPhotoCandidate {
  registration: string | null;
  airline: string | null;
  imageUrl: string;
}

const NOTIFICATION_PHOTO_MANIFEST = notificationPhotoManifest as Record<
  string,
  NotificationPhotoCandidate[]
>;

function getShortAirportCode(icaoCode?: string): string {
  if (!icaoCode) return '???';
  const airport = getAirportInfo(icaoCode);
  return airport?.iata ?? icaoCode.toUpperCase();
}

function getAirportBadge(icaoCode?: string): string {
  if (!icaoCode) {
    return '???';
  }

  const airport = getAirportInfo(icaoCode);
  const code = airport?.iata ?? icaoCode.toUpperCase();
  const flag = airport?.countryCode ? countryCodeToFlag(airport.countryCode) : null;

  return flag ? `${flag} ${code}` : code;
}

function getFlightNotificationTitle(flight: Flight): string {
  const origin = getAirportBadge(flight.origin);
  const destination = getAirportBadge(flight.destination);
  const aircraftType = flight.aircraftType ?? 'Unknown aircraft';
  return `${origin} → ${destination} · ${aircraftType}`;
}

function getFlightNotificationBody(flight: Flight): string {
  return flight.callsign || flight.id;
}

function normalizeRegistration(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeAirlineName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/airlines?|airways|express|group|cargo|regional|mainline|ltd|limited|inc|co\b|company/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAirlineMatchScore(flight: Flight, candidate: NotificationPhotoCandidate): number {
  const flightAirline = normalizeAirlineName(flight.owner);
  const candidateAirline = normalizeAirlineName(candidate.airline);

  if (!flightAirline || !candidateAirline) {
    return 0;
  }

  if (flightAirline === candidateAirline) {
    return 100;
  }

  if (flightAirline.includes(candidateAirline) || candidateAirline.includes(flightAirline)) {
    return 75;
  }

  const flightTokens = new Set(flightAirline.split(' '));
  const candidateTokens = candidateAirline.split(' ');
  const sharedTokens = candidateTokens.filter((token) => token.length >= 3 && flightTokens.has(token));

  return sharedTokens.length * 10;
}

function getFlightNotificationImage(flight: Flight): string | undefined {
  const familyId = getAircraftImageFamilyId(flight.aircraftType);
  if (!familyId) {
    return undefined;
  }

  const candidates = NOTIFICATION_PHOTO_MANIFEST[familyId] ?? [];
  if (candidates.length === 0) {
    return undefined;
  }

  const flightRegistration = normalizeRegistration(flight.registration);
  let bestCandidate: NotificationPhotoCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;

    if (
      flightRegistration &&
      flightRegistration === normalizeRegistration(candidate.registration)
    ) {
      score += 1000;
    }

    score += getAirlineMatchScore(flight, candidate);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  return bestCandidate?.imageUrl ?? candidates[0]?.imageUrl;
}

function notifyBuitenveldertbaan(flights: Flight[]): void {
  if (flights.length === 0) return;
  void showAppNotification('Buitenveldertbaan Active!', {
    body: `${flights.length} flight(s) approaching`,
    tag: 'buitenveldertbaan-active',
  });
}

function notifyNewApproach(flight: Flight): void {
  const image = getFlightNotificationImage(flight);
  void showAppNotification(getFlightNotificationTitle(flight), {
    body: getFlightNotificationBody(flight),
    ...(image ? { icon: image, image } : {}),
    tag: `approach-${flight.id}`,
  });
}

function notifyZoneEntry(flight: Flight): void {
  const image = getFlightNotificationImage(flight);
  void showAppNotification(getFlightNotificationTitle(flight), {
    body: getFlightNotificationBody(flight),
    ...(image ? { icon: image, image } : {}),
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
