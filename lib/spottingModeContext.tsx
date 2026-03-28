'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface SpottingModeContextValue {
  spottingModeEnabled: boolean;
  setSpottingModeEnabled: (enabled: boolean) => void;
}

const SpottingModeContext = createContext<SpottingModeContextValue | null>(null);

const STORAGE_KEY = 'flightnotifier-spotting-mode';

function readStoredValue(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SpottingModeProvider({ children }: { children: ReactNode }) {
  const [spottingModeEnabled, setSpottingModeState] = useState(false);
  const hasSynced = useRef(false);

  const getSyncedValue = useCallback((): boolean => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredValue();
      if (stored) {
        setSpottingModeState(true);
      }
      return stored;
    }
    return spottingModeEnabled;
  }, [spottingModeEnabled]);

  const setSpottingModeEnabled = useCallback((enabled: boolean) => {
    hasSynced.current = true;
    setSpottingModeState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const currentValue = getSyncedValue();

  return (
    <SpottingModeContext.Provider value={{ spottingModeEnabled: currentValue, setSpottingModeEnabled }}>
      {children}
    </SpottingModeContext.Provider>
  );
}

export function useSpottingMode(): SpottingModeContextValue {
  const ctx = useContext(SpottingModeContext);
  if (!ctx) {
    throw new Error('useSpottingMode must be used within SpottingModeProvider');
  }
  return ctx;
}
