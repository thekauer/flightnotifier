'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

export interface ZoneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface NotificationZoneContextValue {
  zone: ZoneBounds | null;
  visible: boolean;
  /** Increments each time the zone is set or cleared — useful for SSE reconnection triggers. */
  zoneVersion: number;
  setZone: (bounds: ZoneBounds) => void;
  clearZone: () => void;
  toggleVisible: () => void;
  isInZone: (lat: number, lng: number) => boolean;
}

const NotificationZoneContext = createContext<NotificationZoneContextValue | null>(null);

export function NotificationZoneProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneState] = useState<ZoneBounds | null>(null);
  const [visible, setVisible] = useState(true);
  const [zoneVersion, setZoneVersion] = useState(0);

  const setZone = useCallback((bounds: ZoneBounds) => {
    setZoneState(bounds);
    setZoneVersion((v) => v + 1);
  }, []);

  const clearZone = useCallback(() => {
    setZoneState(null);
    setZoneVersion((v) => v + 1);
  }, []);

  const toggleVisible = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const isInZone = useCallback(
    (lat: number, lng: number): boolean => {
      if (!zone) return false;
      return (
        lat >= zone.south &&
        lat <= zone.north &&
        lng >= zone.west &&
        lng <= zone.east
      );
    },
    [zone],
  );

  return (
    <NotificationZoneContext.Provider
      value={{ zone, visible, zoneVersion, setZone, clearZone, toggleVisible, isInZone }}
    >
      {children}
    </NotificationZoneContext.Provider>
  );
}

export function useNotificationZone(): NotificationZoneContextValue {
  const ctx = useContext(NotificationZoneContext);
  if (!ctx) {
    throw new Error('useNotificationZone must be used within NotificationZoneProvider');
  }
  return ctx;
}
