'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface StaggerContextValue {
  staggerEnabled: boolean;
  setStaggerEnabled: (enabled: boolean) => void;
  staggerMaxDelayMs: number;
  setStaggerMaxDelayMs: (ms: number) => void;
}

const StaggerContext = createContext<StaggerContextValue | null>(null);

const ENABLED_KEY = 'flightnotifier-stagger-enabled';
const DELAY_KEY = 'flightnotifier-stagger-max-delay-ms';
const DEFAULT_MAX_DELAY_MS = 10000;

function readStoredEnabled(): boolean {
  try {
    const stored = localStorage.getItem(ENABLED_KEY);
    if (stored === null) return true; // enabled by default
    return stored === 'true';
  } catch {
    return true;
  }
}

function readStoredDelay(): number {
  try {
    const v = localStorage.getItem(DELAY_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_MAX_DELAY_MS;
}

export function StaggerProvider({ children }: { children: ReactNode }) {
  const [staggerEnabled, setStaggerState] = useState(true);
  const [staggerMaxDelayMs, setDelayState] = useState(DEFAULT_MAX_DELAY_MS);
  const hasSynced = useRef(false);

  const getSyncedValues = useCallback((): { enabled: boolean; delay: number } => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const storedEnabled = readStoredEnabled();
      const storedDelay = readStoredDelay();
      if (storedEnabled) setStaggerState(true);
      if (storedDelay !== DEFAULT_MAX_DELAY_MS) setDelayState(storedDelay);
      return { enabled: storedEnabled, delay: storedDelay };
    }
    return { enabled: staggerEnabled, delay: staggerMaxDelayMs };
  }, [staggerEnabled, staggerMaxDelayMs]);

  const setStaggerEnabled = useCallback((enabled: boolean) => {
    hasSynced.current = true;
    setStaggerState(enabled);
    try {
      localStorage.setItem(ENABLED_KEY, String(enabled));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const setStaggerMaxDelayMs = useCallback((ms: number) => {
    hasSynced.current = true;
    setDelayState(ms);
    try {
      localStorage.setItem(DELAY_KEY, String(ms));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const current = getSyncedValues();

  return (
    <StaggerContext.Provider value={{
      staggerEnabled: current.enabled,
      setStaggerEnabled,
      staggerMaxDelayMs: current.delay,
      setStaggerMaxDelayMs,
    }}>
      {children}
    </StaggerContext.Provider>
  );
}

export function useStagger(): StaggerContextValue {
  const ctx = useContext(StaggerContext);
  if (!ctx) {
    throw new Error('useStagger must be used within StaggerProvider');
  }
  return ctx;
}
