import { useState, useEffect, useCallback } from 'react';
import type { FlightState, StateChangeEvent, LiveFeedFlight } from '../types';

const INITIAL_STATE: FlightState = {
  allFlights: [],
  approachingFlights: [],
  runway09Active: false,
  lastUpdateMs: 0,
};

function notifyRunway09(flights: LiveFeedFlight[]): void {
  if (Notification.permission !== 'granted') return;
  new Notification('Runway 09 Activated!', {
    body: `${flights.length} flight(s) approaching on Buitenveldertbaan`,
    icon: '/favicon.ico',
  });
}

function notifyNewApproach(flight: LiveFeedFlight): void {
  if (Notification.permission !== 'granted') return;
  const flightNum = flight.extraInfo?.flight || flight.callsign;
  const origin = flight.extraInfo?.route?.from || '?';
  const type = flight.extraInfo?.type || '?';
  new Notification(`New RWY 09 Approach: ${flightNum}`, {
    body: `${flightNum} from ${origin} (${type}) at ${flight.alt}ft`,
    icon: '/favicon.ico',
  });
}

export function useFlightEvents() {
  const [state, setState] = useState<FlightState>(INITIAL_STATE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onopen = () => {
      setConnected(true);
    };

    es.onerror = () => {
      setConnected(false);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as StateChangeEvent;
        switch (parsed.type) {
          case 'flights_updated':
            setState(parsed.state);
            break;
          case 'runway09_activated':
            notifyRunway09(parsed.flights);
            break;
          case 'new_approach':
            notifyNewApproach(parsed.flight);
            break;
          case 'runway09_deactivated':
            break;
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      es.close();
    };
  }, []);

  const requestNotificationPermission = useCallback(() => {
    Notification.requestPermission();
  }, []);

  return { state, connected, requestNotificationPermission };
}
