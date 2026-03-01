import { useMemo } from 'react';
import { useFlightEvents } from './hooks/useFlightEvents';
import { StatusBanner } from './components/StatusBanner';
import { FlightMap } from './components/FlightMap';
import { FlightList } from './components/FlightList';
import { Timetable } from './components/Timetable';

export default function App() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.flightId)),
    [state.approachingFlights],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b px-4 py-3">
        <h1 className="text-xl font-bold">Flight Notifier</h1>
        <p className="text-sm text-muted-foreground">Schiphol Runway 09 Buitenveldertbaan</p>
      </header>
      <StatusBanner
        state={state}
        connected={connected}
        onEnableNotifications={requestNotificationPermission}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <div className="h-[500px] w-full">
          <FlightMap state={state} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Airborne Flights</h2>
          <FlightList flights={state.allFlights} approachingIds={approachingIds} />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold">Upcoming AMS Arrivals</h2>
          <Timetable />
        </div>
      </main>
    </div>
  );
}
