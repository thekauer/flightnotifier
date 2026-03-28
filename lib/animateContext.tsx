'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface AnimateContextValue {
  animateEnabled: boolean;
  setAnimateEnabled: (enabled: boolean) => void;
}

const AnimateContext = createContext<AnimateContextValue | null>(null);

const STORAGE_KEY = 'flightnotifier-animate';

function readStoredValue(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true; // enabled by default
    return stored === 'true';
  } catch {
    return true;
  }
}

export function AnimateProvider({ children }: { children: ReactNode }) {
  const [animateEnabled, setAnimateState] = useState(true);
  const hasSynced = useRef(false);

  const getSyncedValue = useCallback((): boolean => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredValue();
      if (!stored) setAnimateState(false);
      return stored;
    }
    return animateEnabled;
  }, [animateEnabled]);

  const setAnimateEnabled = useCallback((enabled: boolean) => {
    hasSynced.current = true;
    setAnimateState(enabled);
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const currentValue = getSyncedValue();

  return (
    <AnimateContext.Provider value={{ animateEnabled: currentValue, setAnimateEnabled }}>
      {children}
    </AnimateContext.Provider>
  );
}

export function useAnimate(): AnimateContextValue {
  const ctx = useContext(AnimateContext);
  if (!ctx) {
    throw new Error('useAnimate must be used within AnimateProvider');
  }
  return ctx;
}
