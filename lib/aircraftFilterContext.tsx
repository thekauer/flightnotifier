'use client';

import type { ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  getAllTypeCodes,
  getCodesForFamily,
  getCodesForCategory,
} from '@/lib/aircraftTypes';

const AIRCRAFT_FILTER_STORAGE_KEY = 'flightnotifier-aircraft-type-filter';

interface AircraftFilterStoreState {
  enabledTypeCodes: string[];
  toggleType: (code: string) => void;
  toggleFamily: (family: string) => void;
  toggleCategory: (category: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
}

interface AircraftFilterContextValue {
  enabledTypes: Set<string>;
  toggleType: (code: string) => void;
  toggleFamily: (family: string) => void;
  toggleCategory: (category: string) => void;
  isTypeEnabled: (code: string | null | undefined) => boolean;
  selectAll: () => void;
  deselectAll: () => void;
}

const ALL_TYPE_CODES = getAllTypeCodes();
const ALL_TYPE_CODE_SET = new Set(ALL_TYPE_CODES);

const useAircraftFilterStore = create<AircraftFilterStoreState>()(
  persist(
    (set) => ({
      enabledTypeCodes: ALL_TYPE_CODES,
      toggleType: (code) =>
        set((state) => {
          const enabledTypes = new Set(state.enabledTypeCodes);
          if (enabledTypes.has(code)) {
            enabledTypes.delete(code);
          } else {
            enabledTypes.add(code);
          }
          return { enabledTypeCodes: Array.from(enabledTypes) };
        }),
      toggleFamily: (family) =>
        set((state) => {
          const codes = getCodesForFamily(family);
          const enabledTypes = new Set(state.enabledTypeCodes);
          const allEnabled = codes.every((code) => enabledTypes.has(code));

          for (const code of codes) {
            if (allEnabled) {
              enabledTypes.delete(code);
            } else {
              enabledTypes.add(code);
            }
          }

          return { enabledTypeCodes: Array.from(enabledTypes) };
        }),
      toggleCategory: (category) =>
        set((state) => {
          const codes = getCodesForCategory(category);
          const enabledTypes = new Set(state.enabledTypeCodes);
          const allEnabled = codes.every((code) => enabledTypes.has(code));

          for (const code of codes) {
            if (allEnabled) {
              enabledTypes.delete(code);
            } else {
              enabledTypes.add(code);
            }
          }

          return { enabledTypeCodes: Array.from(enabledTypes) };
        }),
      selectAll: () => set({ enabledTypeCodes: ALL_TYPE_CODES }),
      deselectAll: () => set({ enabledTypeCodes: [] }),
    }),
    {
      name: AIRCRAFT_FILTER_STORAGE_KEY,
      partialize: (state) => ({
        enabledTypeCodes: state.enabledTypeCodes,
      }),
    },
  ),
);

export function AircraftFilterProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useAircraftFilter(): AircraftFilterContextValue {
  const enabledTypeCodes = useAircraftFilterStore((state) => state.enabledTypeCodes);
  const toggleType = useAircraftFilterStore((state) => state.toggleType);
  const toggleFamily = useAircraftFilterStore((state) => state.toggleFamily);
  const toggleCategory = useAircraftFilterStore((state) => state.toggleCategory);
  const selectAll = useAircraftFilterStore((state) => state.selectAll);
  const deselectAll = useAircraftFilterStore((state) => state.deselectAll);

  const enabledTypes = new Set(enabledTypeCodes);

  return {
    enabledTypes,
    toggleType,
    toggleFamily,
    toggleCategory,
    isTypeEnabled: (code) => {
      const normalized = code?.trim().toUpperCase();
      if (!normalized) {
        // Keep uncategorized aircraft visible until we know what they are.
        return true;
      }
      if (!ALL_TYPE_CODE_SET.has(normalized)) {
        // New/unknown ICAO type codes should not disappear from the UI.
        return true;
      }
      return enabledTypes.has(normalized);
    },
    selectAll,
    deselectAll,
  };
}
