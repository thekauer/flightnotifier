'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataCell } from './DataCell';
import { VsCell } from './VsCell';
import { AirportCell } from './AirportCell';
import { RunwayPredictionBadge } from './RunwayPredictionBadge';
import { RUNWAY_PREDICTIONS_KEY } from '@/hooks/useFlightEvents';
import { usePredictionHorizon } from '@/lib/predictionHorizonContext';
import type { RunwayPrediction, ScheduledArrival } from '@/lib/types';



export function Timetable() {
  const queryClient = useQueryClient();
  const { horizonMinutes } = usePredictionHorizon();
  const { data: arrivals = [], isLoading } = useQuery<ScheduledArrival[]>({
    queryKey: ['schedule', horizonMinutes],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?horizon=${horizonMinutes}`);
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
    refetchInterval: 10_000,
  });

  // Read runway predictions from the query cache (populated by SSE in useFlightEvents)
  const predictions = queryClient.getQueryData<RunwayPrediction[]>(RUNWAY_PREDICTIONS_KEY) ?? [];
  const predictionMap = new Map(predictions.map((p) => [p.flightId, p]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading schedule...
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No inbound flights
      </div>
    );
  }

  return (
    <div className="max-h-[500px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
          <tr className="border-b">
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Callsign</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">From</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">To</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">V/S</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Distance</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">ETA</th>
            <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">RWY</th>
            <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">BVB</th>
          </tr>
        </thead>
        <tbody>
          {arrivals.map((a) => (
            <tr
              key={a.id}
              className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${a.isBuitenveldertbaan ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''}`}
            >
              <DataCell type="callsign" value={a.callsign || a.id} isApproaching={a.isBuitenveldertbaan} />
              <AirportCell icaoCode={a.origin} />
              <AirportCell icaoCode={a.destination} />
              <DataCell type="aircraftType" value={a.aircraftType} />
              <VsCell value={a.verticalRate ?? 0} />
              <DataCell type="distance" value={a.distanceToAmsKm} />
              <DataCell type="eta" value={a.estimatedMinutes} etaTimestampMs={a.etaTimestampMs} />
              <td className="px-3 py-1.5 text-center">
                {predictionMap.has(a.id) ? (
                  <RunwayPredictionBadge prediction={predictionMap.get(a.id)!} />
                ) : ''}
              </td>
              <td className="px-3 py-1.5 text-center">
                {a.isBuitenveldertbaan ? (
                  <span className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-bold">
                    &#10003;
                  </span>
                ) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
