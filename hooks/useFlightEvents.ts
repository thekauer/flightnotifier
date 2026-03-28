'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightState, StateChangeEvent, Flight } from '@/lib/types';

const INITIAL_STATE: FlightState = {
  allFlights: [],
  approachingFlights: [],
  buitenveldertbaanActive: false,
  lastUpdateMs: 0,
};

const FLIGHT_STATE_KEY = ['flightState'] as const;

function notifyBuitenveldertbaan(flights: Flight[]): void {
  if (Notification.permission !== 'granted') return;
  new Notification('Buitenveldertbaan Active!', {
    body: `${flights.length} flight(s) approaching`,
    icon: '/favicon.ico',
  });
}

function notifyNewApproach(flight: Flight): void {
  if (Notification.permission !== 'granted') return;
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

  useEffect(() => {
    const es = new EventSource('/api/events');

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
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      es.close();
    };
  }, [queryClient]);

  const { data: state = INITIAL_STATE } = useQuery<FlightState>({
    queryKey: FLIGHT_STATE_KEY,
    queryFn: async () => {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to fetch flight state');
      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Only use the REST fallback when SSE hasn't delivered data yet
    enabled: !connectedRef.current,
  });

  const requestNotificationPermission = useCallback(() => {
    Notification.requestPermission();
  }, []);

  return { state, connected, requestNotificationPermission };
}
