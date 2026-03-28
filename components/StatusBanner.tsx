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
  const notificationsGranted =
    typeof Notification !== 'undefined' && Notification.permission === 'granted';

  return (
    <div className="flex flex-wrap items-center gap-4 border-b bg-muted/50 px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div
        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
          state.buitenveldertbaanActive
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}
      >
        {state.buitenveldertbaanActive
          ? `BUITENVELDERTBAAN ACTIVE (${approachCount} on approach)`
          : 'Buitenveldertbaan Inactive'}
      </div>

      <span className="text-muted-foreground">{totalCount} flights tracked</span>

      {!notificationsGranted && (
        <button
          onClick={onEnableNotifications}
          className="ml-auto rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        >
          Enable Notifications
        </button>
      )}
    </div>
  );
}
