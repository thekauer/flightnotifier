'use client';

import { useMemo } from 'react';
import { useFlightState } from '@/lib/flightEventsContext';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useAircraftFilter } from '@/lib/aircraftFilterContext';
import { StatusBanner } from '@/components/StatusBanner';
import { FlightMap } from '@/components/FlightMap';
import { FlightList } from '@/components/FlightList';
import { ConeFlightsTable } from '@/components/ConeFlightsTable';
import { WeatherCard } from '@/components/weather-card/WeatherCard';
import { ScheduledArrivalsTable } from '@/components/ScheduledArrivalsTable';

export default function DashboardPage() {
  const { state, connected, requestNotificationPermission } = useFlightState();
  const { zone, isInZone } = useNotificationZone();
  const { isTypeEnabled } = useAircraftFilter();

  const filteredAllFlights = useMemo(
    () => state.allFlights.filter((flight) => isTypeEnabled(flight.aircraftType)),
    [isTypeEnabled, state.allFlights],
  );
  const filteredApproachingFlights = useMemo(
    () => state.approachingFlights.filter((flight) => isTypeEnabled(flight.aircraftType)),
    [isTypeEnabled, state.approachingFlights],
  );
  const approachingIds = useMemo(
    () => new Set(filteredApproachingFlights.map((f) => f.id)),
    [filteredApproachingFlights],
  );
  const zoneFlightIds = useMemo(() => {
    if (!zone) return new Set<string>();
    return new Set(
      filteredAllFlights
        .filter((f) => !f.onGround && isInZone(f.lat, f.lon))
        .map((f) => f.id),
    );
  }, [zone, isInZone, filteredAllFlights]);

  return (
    <>
      <StatusBanner
        state={state}
        connected={connected}
        onEnableNotifications={requestNotificationPermission}
      />

      <main className="flex flex-1 flex-col gap-3 px-2 pb-4 sm:gap-5 sm:px-6 sm:pb-6">
        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
          <div className="rounded-xl border bg-card shadow-sm lg:row-span-2">
            <div className="px-5 py-3">
              <h2 className="text-sm font-semibold">Map</h2>
            </div>
            <div className="h-[700px]">
              <FlightMap
                state={{
                  ...state,
                  allFlights: filteredAllFlights,
                  approachingFlights: filteredApproachingFlights,
                }}
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <ConeFlightsTable
              flights={filteredApproachingFlights}
              title="Contact"
              zoneFlightIds={zoneFlightIds}
            />
          </div>
          <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Airborne Flights</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {filteredAllFlights.filter((f) => !f.onGround).length}
              </span>
            </div>
            <FlightList flights={filteredAllFlights} approachingIds={approachingIds} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-2">
          <ScheduledArrivalsTable />
          <WeatherCard weather={state.weather ?? null} />
        </div>
      </main>
    </>
  );
}
