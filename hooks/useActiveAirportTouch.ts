'use client';

import { useEffect, useRef } from 'react';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

const AIRPORT_TOUCH_INTERVAL_MS = 4 * 60_000;

export function useActiveAirportTouch() {
  const hasHydrated = useSelectedAirportsStore((state) => state.hasHydrated);
  const selectedAirport = useSelectedAirportsStore((state) => state.selectedAirports[0] ?? null);
  const timerRef = useRef<number | null>(null);
  const airportRef = useRef<AirportSearchRecord | null>(selectedAirport);

  airportRef.current = selectedAirport;

  useEffect(() => {
    async function touchAirport() {
      const airport = airportRef.current;
      if (!airport) {
        return;
      }

      try {
        await fetch('/api/airports/active', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ident: airport.ident,
            iata: airport.iata,
            name: airport.name,
            latitude: airport.latitude,
            longitude: airport.longitude,
          }),
          cache: 'no-store',
        });
      } catch (error) {
        console.error('[airport-activity] Failed to touch airport:', error);
      }
    }

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!hasHydrated || !selectedAirport) {
      return;
    }

    void touchAirport();
    timerRef.current = window.setInterval(() => {
      void touchAirport();
    }, AIRPORT_TOUCH_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasHydrated, selectedAirport]);
}
