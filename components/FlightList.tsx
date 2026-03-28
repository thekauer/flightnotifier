'use client';

import { useMemo, useState } from 'react';
import type { Flight } from '@/lib/types';
import { DataCell } from './DataCell';
import { VsCell } from './VsCell';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { AirportCell } from './AirportCell';
import { useSelectedFlight } from '@/lib/selectedFlightContext';

interface FlightListProps {
  flights: Flight[];
  approachingIds: Set<string>;
}

function isRwy27Approach(f: Flight): boolean {
  return f.track >= 260 && f.track <= 280 && f.alt < 5000 && !f.onGround;
}

export function FlightList({ flights, approachingIds }: FlightListProps) {
  const { selectedFlightId } = useSelectedFlight();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const airborne = useMemo(
    () =>
      flights
        .filter((f) => !f.onGround)
        .sort((a, b) => a.alt - b.alt),
    [flights],
  );

  const toggleExpanded = (flightId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(flightId)) {
      newExpanded.delete(flightId);
    } else {
      newExpanded.add(flightId);
    }
    setExpanded(newExpanded);
  };

  if (airborne.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        No airborne flights
      </div>
    );
  }

  return (
    <div className="max-h-[500px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
          <tr className="border-b">
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Callsign</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">From</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">To</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Alt</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Speed</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">V/S</th>
            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Hdg</th>
          </tr>
        </thead>
        {airborne.map((f) => {
          const isApproaching = approachingIds.has(f.id);
          const isExpanded = expanded.has(f.id);
          const onRwy27 = isRwy27Approach(f);
          return (
            <tbody key={f.id}>
              <tr
                onClick={() => toggleExpanded(f.id)}
                className={`cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/50 ${onRwy27 ? 'bg-amber-50/70 dark:bg-amber-950/30 border-l-3 border-l-amber-500' : isApproaching ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''} ${selectedFlightId === f.id ? 'ring-1 ring-inset ring-orange-300/50 dark:ring-orange-500/30 bg-orange-50/30 dark:bg-orange-950/15' : ''}`}
              >
                <DataCell type="callsign" value={f.callsign || f.id} isExpanded={isExpanded} isApproaching={isApproaching} />
                <DataCell type="aircraftType" value={f.aircraftType} />
                <AirportCell icaoCode={f.origin} />
                <AirportCell icaoCode={f.destination} />
                <DataCell type="altitude" value={f.alt} />
                <DataCell type="speed" value={f.speed} />
                <VsCell value={f.verticalRate} />
                <DataCell type="heading" value={f.track} />
              </tr>
              <tr className={`${isExpanded ? (onRwy27 ? 'bg-amber-50/70 dark:bg-amber-950/30' : isApproaching ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : '') : ''}`} style={{ lineHeight: isExpanded ? undefined : 0 }}>
                <td colSpan={8} className="p-0 border-0">
                  <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
                    <div className="overflow-hidden min-h-0">
                      <div className="px-3 py-3">
                        {(f.manufacturer || f.owner || f.registration || f.route) && (
                          <>
                            <div className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Aircraft Info</div>
                            <div className="bg-muted/40 p-3 text-xs rounded-lg mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                              {f.manufacturer && (
                                <>
                                  <span className="text-muted-foreground">Manufacturer</span>
                                  <span className="font-medium">{f.manufacturer}</span>
                                </>
                              )}
                              {f.aircraftType && (
                                <>
                                  <span className="text-muted-foreground">Type</span>
                                  <span className="font-medium"><AircraftTypeBadge typeCode={f.aircraftType} /></span>
                                </>
                              )}
                              {f.registration && (
                                <>
                                  <span className="text-muted-foreground">Registration</span>
                                  <span className="font-medium">{f.registration}</span>
                                </>
                              )}
                              {f.owner && (
                                <>
                                  <span className="text-muted-foreground">Owner</span>
                                  <span className="font-medium">{f.owner}</span>
                                </>
                              )}
                              {f.route && (
                                <>
                                  <span className="text-muted-foreground">Route</span>
                                  <span className="font-medium">{f.route}</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                        <div className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wider">Flight State</div>
                        <pre className="bg-muted/40 p-3 text-xs font-mono overflow-x-auto rounded-lg">
                          {JSON.stringify(f, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
