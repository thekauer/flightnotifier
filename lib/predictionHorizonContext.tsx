'use client';

import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

interface PredictionHorizonContextValue {
  horizonMinutes: number;
  setHorizonMinutes: (minutes: number) => void;
}

const PredictionHorizonContext = createContext<PredictionHorizonContextValue>({
  horizonMinutes: 60,
  setHorizonMinutes: () => {},
});

const STORAGE_KEY = 'flightnotifier-prediction-horizon';
const DEFAULT_HORIZON = 60;
const MIN_HORIZON = 1;
const MAX_HORIZON = 1440;

function readStoredHorizon(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= MIN_HORIZON && parsed <= MAX_HORIZON) {
        return parsed;
      }
    }
  } catch {
    // localStorage may not be available
  }
  return DEFAULT_HORIZON;
}

function clampHorizon(value: number): number {
  return Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, Math.round(value)));
}

export function PredictionHorizonProvider({ children }: { children: ReactNode }) {
  // Always initialize with default to avoid SSR/client hydration mismatch.
  // localStorage is read lazily on first render on client.
  const [horizonMinutes, setHorizonState] = useState<number>(DEFAULT_HORIZON);
  const hasSynced = useRef(false);

  // Lazily sync from localStorage on first read (client-only)
  const getSyncedHorizon = useCallback((): number => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredHorizon();
      if (stored !== DEFAULT_HORIZON) {
        setHorizonState(stored);
      }
      return stored;
    }
    return horizonMinutes;
  }, [horizonMinutes]);

  const setHorizonMinutes = useCallback((minutes: number) => {
    const clamped = clampHorizon(minutes);
    hasSynced.current = true;
    setHorizonState(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore write errors
    }
  }, []);

  // Read localStorage on first provider render on client
  const currentHorizon = getSyncedHorizon();

  return (
    <PredictionHorizonContext.Provider value={{ horizonMinutes: currentHorizon, setHorizonMinutes }}>
      {children}
    </PredictionHorizonContext.Provider>
  );
}

export function usePredictionHorizon(): PredictionHorizonContextValue {
  return useContext(PredictionHorizonContext);
}

export { MIN_HORIZON, MAX_HORIZON, DEFAULT_HORIZON };
