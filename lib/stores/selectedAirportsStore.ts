'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AirportSearchRecord } from '@/lib/airport-catalog';
import type { SelectedRunwayRecord } from '@/lib/runwaySelection';

const STORAGE_KEY = 'flightnotifier-selected-airports';

interface SelectedAirportsState {
  selectedAirports: AirportSearchRecord[];
  selectedRunways: SelectedRunwayRecord[];
  hasCompletedOnboarding: boolean;
  forceAirportEditing: boolean;
  hasHydrated: boolean;
  selectedAirportChangedAt: number | null;
  setSelectedAirport: (airport: AirportSearchRecord) => void;
  toggleSelectedRunway: (runway: SelectedRunwayRecord) => void;
  clearSelectedRunways: () => void;
  completeOnboarding: () => void;
  reopenOnboarding: () => void;
  consumeAirportEditingRequest: () => void;
  clearSelectedAirports: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useSelectedAirportsStore = create<SelectedAirportsState>()(
  persist(
    (set) => ({
      selectedAirports: [],
      selectedRunways: [],
      hasCompletedOnboarding: false,
      forceAirportEditing: false,
      hasHydrated: false,
      selectedAirportChangedAt: null,
      setSelectedAirport: (airport) =>
        set({
          selectedAirports: [airport],
          selectedRunways: [],
          hasCompletedOnboarding: false,
          forceAirportEditing: false,
          selectedAirportChangedAt: Date.now(),
        }),
      toggleSelectedRunway: (runway) =>
        set((state) => {
          const alreadySelected = state.selectedRunways.some((item) => item.key === runway.key);
          return {
            selectedRunways: alreadySelected
              ? state.selectedRunways.filter((item) => item.key !== runway.key)
              : [...state.selectedRunways, runway],
            hasCompletedOnboarding: false,
          };
        }),
      clearSelectedRunways: () => set({ selectedRunways: [], hasCompletedOnboarding: false }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      reopenOnboarding: () => set({ hasCompletedOnboarding: false, forceAirportEditing: true }),
      consumeAirportEditingRequest: () => set({ forceAirportEditing: false }),
      clearSelectedAirports: () =>
        set({
          selectedAirports: [],
          selectedRunways: [],
          hasCompletedOnboarding: false,
          forceAirportEditing: false,
          selectedAirportChangedAt: null,
        }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        selectedAirports: state.selectedAirports,
        selectedRunways: state.selectedRunways,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedAirportChangedAt: state.selectedAirportChangedAt,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
