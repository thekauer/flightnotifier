'use client';

import NumberFlow from '@number-flow/react';
import { useEffect, useState } from 'react';
import type { FlightState } from '@/lib/types';
import { formatSelectedRunwayLabel } from '@/lib/runwaySelection';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';

const WAITING_FOR_DATA_WINDOW_MS = 2 * 60_000;

interface StatusBannerProps {
  state: FlightState;
  connected: boolean;
  onEnableNotifications: () => void;
}

export function StatusBanner({ state, connected, onEnableNotifications }: StatusBannerProps) {
  const approachCount = state.approachingFlights.length;
  const totalCount = state.allFlights.length;
  const airborneCount = state.allFlights.filter((f) => !f.onGround).length;
  const selectedRunways = useSelectedAirportsStore((store) => store.selectedRunways);
  const selectedAirportChangedAt = useSelectedAirportsStore((store) => store.selectedAirportChangedAt);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const notificationsGranted =
    typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const selectedRunwaysForAirport = selectedRunways.filter(
    (runway) => runway.airportIdent === state.focusAirportIdent,
  );
  const activityLabel =
    selectedRunwaysForAirport.length > 0
      ? selectedRunwaysForAirport.map(formatSelectedRunwayLabel).join(', ')
      : 'Approach';
  const isWaitingForData =
    connected &&
    totalCount === 0 &&
    selectedAirportChangedAt !== null &&
    nowMs - selectedAirportChangedAt < WAITING_FOR_DATA_WINDOW_MS;

  useEffect(() => {
    if (selectedAirportChangedAt === null) {
      return;
    }

    const expiresAt = selectedAirportChangedAt + WAITING_FOR_DATA_WINDOW_MS;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      setNowMs(Date.now());
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNowMs(Date.now());
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedAirportChangedAt]);

  const connectionDotClass = !connected
    ? 'bg-red-500'
    : isWaitingForData
      ? 'bg-violet-500 animate-pulse'
      : 'bg-emerald-500 animate-pulse';

  const connectionLabel = !connected
    ? 'Offline'
    : isWaitingForData
      ? 'Waiting for data'
      : 'Live';

  const connectionTextClass = isWaitingForData ? 'text-violet-700 dark:text-violet-300' : '';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-2 py-2 mb-1 text-xs sm:px-6 sm:py-2.5 sm:mb-2">
      {/* Connection */}
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${connectionDotClass}`} />
        <span className={`font-medium ${connectionTextClass}`}>{connectionLabel}</span>
      </div>

      
      {/* Flights */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Tracked</span>
        <span className="font-bold"><NumberFlow value={totalCount} willChange /></span>
        <span className="text-muted-foreground">/</span>
        <span className="font-bold"><NumberFlow value={airborneCount} willChange /></span>
        <span className="text-muted-foreground">airborne</span>
      </div>

      
      {/* Buitenveldertbaan */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{activityLabel}</span>
        {state.buitenveldertbaanActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active · {approachCount} on approach
          </span>
        ) : (
          <span className="font-medium text-muted-foreground">Inactive</span>
        )}
      </div>

      
      {/* Notifications */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Notifications</span>
        {notificationsGranted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            Enabled
          </span>
        ) : (
          <button
            onClick={onEnableNotifications}
            className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Enable
          </button>
        )}
      </div>
    </div>
  );
}
