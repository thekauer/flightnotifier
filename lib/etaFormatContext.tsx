'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type EtaFormat = 'colon' | 'quotes';

interface EtaFormatContextValue {
  etaFormat: EtaFormat;
  setEtaFormat: (format: EtaFormat) => void;
}

const EtaFormatContext = createContext<EtaFormatContextValue | null>(null);

const STORAGE_KEY = 'flightnotifier-eta-format';
const DEFAULT_FORMAT: EtaFormat = 'colon';

function readStoredFormat(): EtaFormat {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'colon' || stored === 'quotes') return stored;
  } catch {
    // ignore
  }
  return DEFAULT_FORMAT;
}

export function EtaFormatProvider({ children }: { children: ReactNode }) {
  const [etaFormat, setFormatState] = useState<EtaFormat>(DEFAULT_FORMAT);
  const hasSynced = useRef(false);

  const getSyncedValue = useCallback((): EtaFormat => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredFormat();
      if (stored !== DEFAULT_FORMAT) setFormatState(stored);
      return stored;
    }
    return etaFormat;
  }, [etaFormat]);

  const setEtaFormat = useCallback((format: EtaFormat) => {
    hasSynced.current = true;
    setFormatState(format);
    try {
      localStorage.setItem(STORAGE_KEY, format);
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const current = getSyncedValue();

  return (
    <EtaFormatContext.Provider value={{ etaFormat: current, setEtaFormat }}>
      {children}
    </EtaFormatContext.Provider>
  );
}

export function useEtaFormat(): EtaFormatContextValue {
  const ctx = useContext(EtaFormatContext);
  if (!ctx) {
    throw new Error('useEtaFormat must be used within EtaFormatProvider');
  }
  return ctx;
}
