'use client';

import { useMemo } from 'react';
import { useFlightState } from '@/lib/flightEventsContext';
import { useAircraftFilter } from '@/lib/aircraftFilterContext';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { ConeFlightsTable } from '@/components/ConeFlightsTable';
import { ScheduledArrivalsTable } from '@/components/ScheduledArrivalsTable';

export default function PredictionsPage() {
  const { state } = useFlightState();
  const { isTypeEnabled } = useAircraftFilter();
  const { zone, isInZone } = useNotificationZone();

  const filteredAllFlights = useMemo(
    () => state.allFlights.filter((flight) => isTypeEnabled(flight.aircraftType)),
    [isTypeEnabled, state.allFlights],
  );
  const filteredApproachingFlights = useMemo(
    () => state.approachingFlights.filter((flight) => isTypeEnabled(flight.aircraftType)),
    [isTypeEnabled, state.approachingFlights],
  );

  const zoneFlights = useMemo(
    () => (zone ? filteredAllFlights.filter((f) => !f.onGround && isInZone(f.lat, f.lon)) : []),
    [zone, isInZone, filteredAllFlights],
  );

  return (
    <main className="flex flex-1 flex-col gap-3 px-2 py-4 sm:gap-5 sm:px-6 sm:py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Predictions Inputs</h2>
        <p className="text-sm text-muted-foreground">
          Live cone traffic and scheduled arrivals to Amsterdam, with historical paths per scheduled flight
        </p>
      </div>
      {zone && (
        <ConeFlightsTable
          flights={zoneFlights}
          title="Aircraft Visible"
          emptyLabel="No aircraft currently inside the zone"
        />
      )}
      <ConeFlightsTable flights={filteredApproachingFlights} />
      <ScheduledArrivalsTable />
    </main>
  );
}
