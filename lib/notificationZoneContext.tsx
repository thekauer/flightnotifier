'use client';

import { createContext, useContext, useCallback, useRef, useState, type ReactNode } from 'react';

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

const ZONE_STORAGE_KEY = 'flightnotifier-notification-zone';
const VISIBLE_STORAGE_KEY = 'flightnotifier-notification-zone-visible';

interface StoredZoneState {
  zone: ZoneBounds | null;
  visible: boolean;
}

function readStoredState(): StoredZoneState {
  try {
    const zoneRaw = localStorage.getItem(ZONE_STORAGE_KEY);
    const visibleRaw = localStorage.getItem(VISIBLE_STORAGE_KEY);
    return {
      zone: zoneRaw ? (JSON.parse(zoneRaw) as ZoneBounds) : null,
      visible: visibleRaw !== null ? visibleRaw === 'true' : true,
    };
  } catch {
    return { zone: null, visible: true };
  }
}

function writeZone(zone: ZoneBounds | null) {
  try {
    if (zone) {
      localStorage.setItem(ZONE_STORAGE_KEY, JSON.stringify(zone));
    } else {
      localStorage.removeItem(ZONE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write failures.
  }
}

function writeVisible(visible: boolean) {
  try {
    localStorage.setItem(VISIBLE_STORAGE_KEY, String(visible));
  } catch {
    // Ignore storage write failures.
  }
}

export function NotificationZoneProvider({ children }: { children: ReactNode }) {
  const [zone, setZoneRaw] = useState<ZoneBounds | null>(null);
  const [visible, setVisibleRaw] = useState(true);
  const [zoneVersion, setZoneVersion] = useState(0);
  const hasSynced = useRef(false);

  const syncFromStorage = useCallback(() => {
    if (!hasSynced.current && typeof window !== 'undefined') {
      hasSynced.current = true;
      const stored = readStoredState();
      if (stored.zone) {
        setZoneRaw(stored.zone);
        setZoneVersion((v) => v + 1);
      }
      if (!stored.visible) {
        setVisibleRaw(false);
      }
      return stored;
    }
    return null;
  }, []);

  // Lazy-sync on first render (avoids hydration mismatch)
  const synced = syncFromStorage();
  const currentZone = synced ? synced.zone : zone;
  const currentVisible = synced ? synced.visible : visible;

  const setZone = useCallback((bounds: ZoneBounds) => {
    hasSynced.current = true;
    setZoneRaw(bounds);
    setZoneVersion((v) => v + 1);
    writeZone(bounds);
  }, []);

  const clearZone = useCallback(() => {
    hasSynced.current = true;
    setZoneRaw(null);
    setZoneVersion((v) => v + 1);
    writeZone(null);
  }, []);

  const toggleVisible = useCallback(() => {
    setVisibleRaw((v) => {
      const next = !v;
      writeVisible(next);
      return next;
    });
  }, []);

  const isInZone = useCallback(
    (lat: number, lng: number): boolean => {
      if (!currentZone) return false;
      return (
        lat >= currentZone.south &&
        lat <= currentZone.north &&
        lng >= currentZone.west &&
        lng <= currentZone.east
      );
    },
    [currentZone],
  );

  return (
    <NotificationZoneContext.Provider
      value={{ zone: currentZone, visible: currentVisible, zoneVersion, setZone, clearZone, toggleVisible, isInZone }}
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
