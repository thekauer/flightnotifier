'use client';

import { useQuery } from '@tanstack/react-query';
import type { AirportMovementFilter } from '@/lib/airportMovements';
import type { AirportCorridorsPayload } from '@/lib/airportCorridors';
import { AirportCorridorsMap } from '@/components/AirportCorridorsMap';

interface AirportCorridorsExplorerProps {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  selectedRunways: string[];
  windowMinutes: number;
  smoothCorridors: boolean;
  smoothingAmount: number;
}

export function AirportCorridorsExplorer({
  airportIdent,
  date,
  movement,
  selectedRunways,
  windowMinutes,
  smoothCorridors,
  smoothingAmount,
}: AirportCorridorsExplorerProps) {
  const { data, isLoading, error, isFetching } = useQuery<AirportCorridorsPayload>({
    queryKey: ['airportCorridors', airportIdent, date, movement, windowMinutes],
    queryFn: async () => {
      const params = new URLSearchParams({
        airport: airportIdent,
        date,
        movement,
        windowMinutes: String(windowMinutes),
      });
      const response = await fetch(`/api/airport-corridors?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch airport corridors');
      }
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const filteredData =
    data && selectedRunways.length > 0
      ? {
          ...data,
          corridorCount: data.corridors.filter(
            (corridor) => corridor.inferredRunway != null && selectedRunways.includes(corridor.inferredRunway),
          ).length,
          sourceTrackCount: data.corridors
            .filter((corridor) => corridor.inferredRunway != null && selectedRunways.includes(corridor.inferredRunway))
            .reduce((sum, corridor) => sum + corridor.sampleCount, 0),
          corridors: data.corridors.filter(
            (corridor) => corridor.inferredRunway != null && selectedRunways.includes(corridor.inferredRunway),
          ),
        }
      : data;

  if (isLoading) {
    return <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">Loading corridor templates...</div>;
  }

  if (error || !filteredData) {
    return <div className="rounded-2xl border bg-card p-6 text-sm text-rose-600 dark:text-rose-400">Failed to load corridor templates.</div>;
  }

  return (
    <div className="space-y-4">
      <AirportCorridorsMap
        data={filteredData}
        smoothCorridors={smoothCorridors}
        smoothingAmount={smoothingAmount}
      />
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        Aggregated from the current movement selection into reusable route templates.
        {selectedRunways.length > 0 ? ` Filtered to RWY ${selectedRunways.join(', ')}.` : ''}
        {isFetching ? ' Refreshing…' : ''}
      </div>
    </div>
  );
}
