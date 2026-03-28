'use client';

import type { FlightState } from '@/lib/types';

interface StatusBannerProps {
  state: FlightState;
  connected: boolean;
  onEnableNotifications: () => void;
}

export function StatusBanner({ state, connected, onEnableNotifications }: StatusBannerProps) {
  const approachCount = state.approachingFlights.length;
  const totalCount = state.allFlights.length;
  const airborneCount = state.allFlights.filter((f) => !f.onGround).length;
  const notificationsGranted =
    typeof Notification !== 'undefined' && Notification.permission === 'granted';

  return (
    <div className="flex flex-wrap items-center justify-between border-b bg-card px-6 py-2.5 text-xs">
      {/* Connection */}
      <div className="flex items-center gap-1.5">
        <span
          className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
        />
        <span className="font-medium">{connected ? 'Live' : 'Offline'}</span>
      </div>

      <span className="text-muted-foreground/30">|</span>

      {/* Flights */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Tracked</span>
        <span className="font-bold tabular-nums">{totalCount}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-bold tabular-nums">{airborneCount}</span>
        <span className="text-muted-foreground">airborne</span>
      </div>

      <span className="text-muted-foreground/30">|</span>

      {/* Buitenveldertbaan */}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">RWY 09/27</span>
        {state.buitenveldertbaanActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active · {approachCount} on approach
          </span>
        ) : (
          <span className="font-medium text-muted-foreground">Inactive</span>
        )}
      </div>

      <span className="text-muted-foreground/30">|</span>

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
