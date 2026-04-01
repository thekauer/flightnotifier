'use client';

import { createContext, useContext } from 'react';
import { useFlightEvents } from '@/hooks/useFlightEvents';
import type { FlightState } from '@/lib/types';

interface FlightEventsContextValue {
  state: FlightState;
  connected: boolean;
  requestNotificationPermission: () => void;
}

const FlightEventsContext = createContext<FlightEventsContextValue | null>(null);

export function FlightEventsProvider({ children }: { children: React.ReactNode }) {
  const value = useFlightEvents();
  return <FlightEventsContext.Provider value={value}>{children}</FlightEventsContext.Provider>;
}

export function useFlightState() {
  const ctx = useContext(FlightEventsContext);
  if (!ctx) throw new Error('useFlightState must be used within FlightEventsProvider');
  return ctx;
}
