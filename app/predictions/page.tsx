'use client';

import { useMemo } from 'react';
import { useFlightState } from '@/lib/flightEventsContext';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { ConeFlightsTable } from '@/components/ConeFlightsTable';
import { ScheduledArrivalsTable } from '@/components/ScheduledArrivalsTable';

export default function PredictionsPage() {
  const { state } = useFlightState();
  const { zone, isInZone } = useNotificationZone();

  const zoneFlights = useMemo(
    () => (zone ? state.allFlights.filter((f) => !f.onGround && isInZone(f.lat, f.lon)) : []),
    [zone, isInZone, state.allFlights],
  );

  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6">
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
      <ConeFlightsTable flights={state.approachingFlights} />
      <ScheduledArrivalsTable />
    </main>
  );
}
