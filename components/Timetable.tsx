'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataCell } from './DataCell';

interface ScheduledArrival {
  id: string;
  callsign: string;
  aircraftType: string | null;
  registration: string | null;
  originCountry: string;
  altitude: number;
  speed: number;
  distanceToAmsKm: number;
  estimatedMinutes: number;
  isBuitenveldertbaan: boolean;
}

function formatEta(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60);
    return `${seconds}s`;
  }
  if (minutes < 60) {
    return `${Math.floor(minutes)} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function Timetable() {
  const [, setTick] = useState(0);
  const { data: arrivals = [], isLoading, dataUpdatedAt } = useQuery<ScheduledArrival[]>({
    queryKey: ['schedule'],
    queryFn: async () => {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule...</p>;
  }

  if (arrivals.length === 0) {
    return <p className="text-sm text-muted-foreground">No inbound flights</p>;
  }

  return (
    <div className="max-h-[400px] overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Callsign</th>
            <th className="px-3 py-2 text-left font-medium">Country</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-right font-medium">Distance (km)</th>
            <th className="px-3 py-2 text-right font-medium">ETA</th>
            <th className="px-3 py-2 text-center font-medium">BVB</th>
          </tr>
        </thead>
        <tbody>
          {arrivals.map((a) => {
            const elapsedSinceRefetchMs = Date.now() - dataUpdatedAt;
            const elapsedMinutes = elapsedSinceRefetchMs / 60000;
            const liveEtaMinutes = Math.max(0, a.estimatedMinutes - elapsedMinutes);

            return (
              <tr
                key={a.id}
                className={a.isBuitenveldertbaan ? 'bg-green-50 dark:bg-green-950' : ''}
              >
                <DataCell type="callsign" value={a.callsign || a.id} isApproaching={a.isBuitenveldertbaan} />
                <DataCell type="country" value={a.originCountry} />
                <DataCell type="aircraftType" value={a.aircraftType} />
                <DataCell type="distance" value={a.distanceToAmsKm} />
                <DataCell type="eta" value={formatEta(liveEtaMinutes)} />
                <td className="px-3 py-1.5 text-center">
                  {a.isBuitenveldertbaan ? <span className="text-green-600">&#10003;</span> : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
