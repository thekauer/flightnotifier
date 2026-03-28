'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  getAllTypeCodes,
  getCodesForFamily,
  getCodesForCategory,
} from '@/lib/aircraftTypes';

interface AircraftFilterContextValue {
  enabledTypes: Set<string>;
  toggleType: (code: string) => void;
  toggleFamily: (family: string) => void;
  toggleCategory: (category: string) => void;
  isTypeEnabled: (code: string) => boolean;
  selectAll: () => void;
  deselectAll: () => void;
}

const AircraftFilterContext = createContext<AircraftFilterContextValue | null>(null);

export function AircraftFilterProvider({ children }: { children: ReactNode }) {
  const [enabledTypes, setEnabledTypes] = useState<Set<string>>(
    () => new Set(getAllTypeCodes()),
  );

  const toggleType = useCallback((code: string) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const toggleFamily = useCallback((family: string) => {
    setEnabledTypes((prev) => {
      const codes = getCodesForFamily(family);
      const allEnabled = codes.every((c) => prev.has(c));
      const next = new Set(prev);
      if (allEnabled) {
        // Uncheck all in this family
        for (const c of codes) next.delete(c);
      } else {
        // Check all in this family
        for (const c of codes) next.add(c);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setEnabledTypes((prev) => {
      const codes = getCodesForCategory(category);
      const allEnabled = codes.every((c) => prev.has(c));
      const next = new Set(prev);
      if (allEnabled) {
        for (const c of codes) next.delete(c);
      } else {
        for (const c of codes) next.add(c);
      }
      return next;
    });
  }, []);

  const isTypeEnabled = useCallback(
    (code: string) => enabledTypes.has(code),
    [enabledTypes],
  );

  const selectAll = useCallback(() => {
    setEnabledTypes(new Set(getAllTypeCodes()));
  }, []);

  const deselectAll = useCallback(() => {
    setEnabledTypes(new Set());
  }, []);

  return (
    <AircraftFilterContext.Provider
      value={{ enabledTypes, toggleType, toggleFamily, toggleCategory, isTypeEnabled, selectAll, deselectAll }}
    >
      {children}
    </AircraftFilterContext.Provider>
  );
}

export function useAircraftFilter(): AircraftFilterContextValue {
  const ctx = useContext(AircraftFilterContext);
  if (!ctx) {
    throw new Error('useAircraftFilter must be used within an AircraftFilterProvider');
  }
  return ctx;
}
