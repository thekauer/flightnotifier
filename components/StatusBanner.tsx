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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 p-4">
      {/* Connection status card */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connection</p>
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
        </div>
        <p className="mt-2 text-2xl font-bold">{connected ? 'Live' : 'Offline'}</p>
        <p className="mt-1 text-xs text-muted-foreground">SSE stream</p>
      </div>

      {/* Total flights card */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flights Tracked</p>
        <p className="mt-2 text-2xl font-bold">{totalCount}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{airborneCount}</span> airborne
        </p>
      </div>

      {/* Buitenveldertbaan status card */}
      <div className={`rounded-xl border p-4 ${
        state.buitenveldertbaanActive
          ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800'
          : 'bg-card'
      }`}>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Buitenveldertbaan</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="text-2xl font-bold">
            {state.buitenveldertbaanActive ? 'Active' : 'Inactive'}
          </p>
          {state.buitenveldertbaanActive && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              {approachCount} on approach
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Runway 09/27</p>
      </div>

      {/* Notifications card */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notifications</p>
        {notificationsGranted ? (
          <>
            <p className="mt-2 text-2xl font-bold">Enabled</p>
            <p className="mt-1 text-xs text-muted-foreground">Push alerts active</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold text-muted-foreground">Off</p>
            <button
              onClick={onEnableNotifications}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Enable
            </button>
          </>
        )}
      </div>
    </div>
  );
}
