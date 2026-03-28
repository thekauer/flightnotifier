'use client';

import { useMemo } from 'react';
import { useFlightEvents } from '@/hooks/useFlightEvents';
import { StatusBanner } from '@/components/StatusBanner';
import { FlightMap } from '@/components/FlightMap';
import { FlightList } from '@/components/FlightList';
import { Timetable } from '@/components/Timetable';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export default function Home() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.id)),
    [state.approachingFlights],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h1 className="text-xl font-bold">Flight Notifier</h1>
          <p className="text-sm text-muted-foreground">Schiphol Buitenveldertbaan</p>
        </div>
        <div className="ml-auto">
          <ThemeSwitcher />
        </div>
      </header>
      <StatusBanner
        state={state}
        connected={connected}
        onEnableNotifications={requestNotificationPermission}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="h-[300px] w-full rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-lg font-semibold">Map</h2>
            <div className="h-[calc(100%-2rem)]">
              <FlightMap state={state} />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-2 text-lg font-semibold">Airborne Flights</h2>
            <FlightList flights={state.allFlights} approachingIds={approachingIds} />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">Upcoming Arrivals</h2>
          <Timetable />
        </div>
      </main>
    </div>
  );
}
