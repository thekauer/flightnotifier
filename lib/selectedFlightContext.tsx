'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface SelectedFlightContextValue {
  selectedFlightId: string | null;
  setSelectedFlightId: (id: string | null) => void;
}

const SelectedFlightContext = createContext<SelectedFlightContextValue>({
  selectedFlightId: null,
  setSelectedFlightId: () => {},
});

export function SelectedFlightProvider({ children }: { children: ReactNode }) {
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  return (
    <SelectedFlightContext.Provider value={{ selectedFlightId, setSelectedFlightId }}>
      {children}
    </SelectedFlightContext.Provider>
  );
}

export function useSelectedFlight(): SelectedFlightContextValue {
  return useContext(SelectedFlightContext);
}
