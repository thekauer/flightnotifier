'use client';

import { useMemo } from 'react';
import type { Flight } from '@/lib/types';
import { DataCell } from './DataCell';
import { AirportCell } from './AirportCell';

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


interface ConeFlightRow extends Flight {
  distanceToAmsKm: number;
  estimatedMinutes: number;
}

interface ConeFlightsTableProps {
  flights: Flight[];
  title?: string;
  emptyLabel?: string;
  zoneFlightIds?: Set<string>;
}

export function ConeFlightsTable({
  flights,
  title = 'Aircraft In Cone',
  emptyLabel = 'No aircraft currently inside the cone',
  zoneFlightIds,
}: ConeFlightsTableProps) {
  const rows = useMemo<ConeFlightRow[]>(
    () =>
      flights
        .map((flight) => {
          const distanceToAmsKm = Math.round(
            haversineKm(flight.lat, flight.lon, SCHIPHOL_LAT, SCHIPHOL_LON),
          );
          const speedKmh = flight.speed * 1.852;
          const estimatedMinutes =
            speedKmh > 0 ? Math.max(0, (distanceToAmsKm / speedKmh) * 60) : Number.POSITIVE_INFINITY;

          return {
            ...flight,
            distanceToAmsKm,
            estimatedMinutes,
          };
        })
        .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes),
    [flights],
  );

  return (
    <div className="rounded-xl border bg-card shadow-sm" suppressHydrationWarning>
      <div className="border-b px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/80 backdrop-blur-sm">
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
                  Alt
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Speed
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  V/S
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
              {rows.map((flight) => (
                <tr
                  key={flight.id}
                  className={`border-b border-border/50 ${
                    zoneFlightIds?.has(flight.id)
                      ? 'bg-blue-50/40 dark:bg-blue-950/20'
                      : 'bg-emerald-50/40 dark:bg-emerald-950/20'
                  }`}
                >
                  <DataCell
                    type="callsign"
                    value={flight.callsign || flight.id}
                    isApproaching={true}
                  />
                  <AirportCell icaoCode={flight.origin} />
                  <AirportCell icaoCode={flight.destination} />
                  <DataCell type="aircraftType" value={flight.aircraftType} />
                  <DataCell type="altitude" value={flight.alt} />
                  <DataCell type="speed" value={flight.speed} />
                  <DataCell type="verticalSpeed" value={flight.verticalRate} />
                  <DataCell type="distance" value={flight.distanceToAmsKm} />
                  <DataCell type="eta" value={flight.estimatedMinutes} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
