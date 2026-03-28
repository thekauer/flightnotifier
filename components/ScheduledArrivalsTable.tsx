'use client';

import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoricalFlightPath, ScheduledArrival } from '@/lib/types';
import { AirportCell } from './AirportCell';
import { DataCell } from './DataCell';
import { HistoricApproachMap } from './HistoricApproachMap';
import { usePredictionHorizon } from '@/lib/predictionHorizonContext';
import { useScheduleData } from '@/hooks/useScheduleData';

function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function HistoricalFlightDetails({ arrival }: { arrival: ScheduledArrival }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const normalizedCallsign = arrival.callsign.trim();
  const { data: history = [], isLoading, error } = useQuery<HistoricalFlightPath[]>({
    queryKey: ['flightHistory', arrival.callsign, arrival.origin, arrival.destination],
    queryFn: async () => {
      const params = new URLSearchParams({
        callsign: normalizedCallsign,
      });
      if (arrival.origin) {
        params.set('origin', arrival.origin);
      }
      if (arrival.destination) {
        params.set('destination', arrival.destination);
      }

      const res = await fetch(`/api/flight-history?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch historical flight path');
      }
      return res.json();
    },
    enabled: normalizedCallsign.length > 0,
    refetchOnWindowFocus: false,
  });

  if (normalizedCallsign.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-muted-foreground">
        No flight number is available for historical lookup.
      </div>
    );
  }

  const selected = useMemo(() => {
    if (history.length === 0) return null;
    return (
      history.find((entry: HistoricalFlightPath) => `${entry.icao24}-${entry.lastSeen}` === selectedKey) ??
      history[0]!
    );
  }, [history, selectedKey]);

  if (isLoading) {
    return (
      <div className="px-4 py-4 text-sm text-muted-foreground">
        Loading historical flight path...
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4 text-sm text-rose-600 dark:text-rose-400">
        Failed to load historical flight path.
      </div>
    );
  }

  if (history.length === 0 || !selected) {
    return (
      <div className="px-4 py-4 text-sm text-muted-foreground">
        No recent historical arrivals found for this flight.
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Historic Arrivals
          </h4>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/80">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cone
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry: HistoricalFlightPath) => {
                  const rowKey = `${entry.icao24}-${entry.lastSeen}`;
                  const isSelected = selected === entry;

                  return (
                    <tr
                      key={rowKey}
                      className={`border-b border-border/50 ${
                        isSelected ? 'bg-muted/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedKey(rowKey)}
                          className="text-left text-sm font-medium hover:underline"
                        >
                          {formatTimestamp(entry.lastSeen)}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-sm">{entry.origin ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            entry.interceptedCone
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {entry.interceptedCone ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Historic Approach Map
            </h4>
            <div className="text-xs text-muted-foreground">
              {selected.interceptedCone ? 'Path intercepted cone' : 'Path did not intercept cone'}
            </div>
          </div>
          <HistoricApproachMap history={selected} />
        </div>
      </div>
    </div>
  );
}

export function ScheduledArrivalsTable() {
  const { horizonMinutes } = usePredictionHorizon();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { arrivals, isLoading } = useScheduleData(horizonMinutes);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Scheduled Arrivals To Amsterdam</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {arrivals.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading scheduled arrivals...
        </div>
      ) : arrivals.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          No scheduled arrivals
        </div>
      ) : (
        <div className="max-h-[400px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="border-b">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Callsign
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  From
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  To
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Distance
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ETA
                </th>
              </tr>
            </thead>
            <tbody>
              {arrivals.map((arrival: ScheduledArrival) => {
                const isExpanded = expandedId === arrival.id;
                return (
                  <Fragment key={arrival.id}>
                    <tr
                      className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${
                        arrival.isBuitenveldertbaan ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => setExpandedId((current) => (current === arrival.id ? null : arrival.id))}
                          className="flex items-center gap-2 text-left"
                        >
                          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                          <span>{arrival.callsign || arrival.id}</span>
                        </button>
                      </td>
                      <AirportCell icaoCode={arrival.origin} />
                      <AirportCell icaoCode={arrival.destination} />
                      <DataCell type="aircraftType" value={arrival.aircraftType} />
                      <DataCell type="distance" value={arrival.distanceToAmsKm} />
                      <DataCell type="eta" value={arrival.estimatedMinutes} />
                    </tr>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <td colSpan={6} className="p-0">
                        <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
                          <div className="overflow-hidden min-h-0">
                            <HistoricalFlightDetails arrival={arrival} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
