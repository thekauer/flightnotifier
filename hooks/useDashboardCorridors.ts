'use client';

import { useQuery } from '@tanstack/react-query';
import type { AirportCorridorsPayload } from '@/lib/airportCorridors';

function defaultHistoricalDate(): string {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useDashboardCorridors(airportIdent: string, windowMinutes = 60) {
  return useQuery<{
    arrival: AirportCorridorsPayload;
    departure: AirportCorridorsPayload;
  }>({
    queryKey: ['dashboardCorridors', airportIdent, windowMinutes],
    queryFn: async () => {
      const date = defaultHistoricalDate();
      const [arrivalResponse, departureResponse] = await Promise.all([
        fetch(
          `/api/airport-corridors?airport=${encodeURIComponent(airportIdent)}&date=${date}&movement=arrival&windowMinutes=${windowMinutes}`,
        ),
        fetch(
          `/api/airport-corridors?airport=${encodeURIComponent(airportIdent)}&date=${date}&movement=departure&windowMinutes=${windowMinutes}`,
        ),
      ]);

      if (!arrivalResponse.ok || !departureResponse.ok) {
        throw new Error('Failed to load dashboard corridors');
      }

      const [arrival, departure] = await Promise.all([
        arrivalResponse.json() as Promise<AirportCorridorsPayload>,
        departureResponse.json() as Promise<AirportCorridorsPayload>,
      ]);

      return { arrival, departure };
    },
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
