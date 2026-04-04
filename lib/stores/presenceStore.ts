'use client';

import { create } from 'zustand';

interface PresenceState {
  connected: boolean;
  totalUsers: number;
  airportUsers: number;
  airportIdent: string | null;
  setPresence: (state: {
    connected: boolean;
    totalUsers: number;
    airportUsers: number;
    airportIdent: string | null;
  }) => void;
  setConnected: (connected: boolean) => void;
  resetPresence: () => void;
}

const INITIAL_STATE = {
  connected: false,
  totalUsers: 0,
  airportUsers: 0,
  airportIdent: null,
};

export const usePresenceStore = create<PresenceState>((set) => ({
  ...INITIAL_STATE,
  setPresence: (state) => set(state),
  setConnected: (connected) => set({ connected }),
  resetPresence: () => set(INITIAL_STATE),
}));
