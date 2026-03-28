'use client';

import { useMemo, useState } from 'react';
import type { Flight } from '@/lib/types';
import { DataCell } from './DataCell';

interface FlightListProps {
  flights: Flight[];
  approachingIds: Set<string>;
}

export function FlightList({ flights, approachingIds }: FlightListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [aircraftInfo, setAircraftInfo] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());

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

  const fetchAircraftInfo = async (icao24: string) => {
    setLoading(prev => new Set(prev).add(icao24));
    try {
      const res = await fetch(`https://hexdb.io/api/v1/aircraft/${icao24}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAircraftInfo(prev => ({ ...prev, [icao24]: data }));
    } catch (err) {
      setAircraftInfo(prev => ({ ...prev, [icao24]: { error: String(err) } }));
    } finally {
      setLoading(prev => { const next = new Set(prev); next.delete(icao24); return next; });
    }
  };

  if (airborne.length === 0) {
    return <p className="text-sm text-muted-foreground">No airborne flights</p>;
  }

  return (
    <div className="max-h-[400px] overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Callsign</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Country</th>
            <th className="px-3 py-2 text-right font-medium">Alt</th>
            <th className="px-3 py-2 text-right font-medium">Speed</th>
            <th className="px-3 py-2 text-right font-medium">V/S</th>
            <th className="px-3 py-2 text-right font-medium">Hdg</th>
            <th className="px-3 py-2 text-center font-medium">Info</th>
          </tr>
        </thead>
        {airborne.map((f) => {
          const isApproaching = approachingIds.has(f.id);
          const isExpanded = expanded.has(f.id);
          return (
            <tbody key={f.id}>
              <tr
                onClick={() => toggleExpanded(f.id)}
                className={`cursor-pointer ${isApproaching ? 'bg-green-50 dark:bg-green-950' : ''}`}
              >
                <DataCell type="callsign" value={f.callsign || f.id} isExpanded={isExpanded} isApproaching={isApproaching} />
                <DataCell type="aircraftType" value={f.aircraftType} />
                <DataCell type="country" value={f.originCountry} />
                <DataCell type="altitude" value={f.alt} />
                <DataCell type="speed" value={f.speed} />
                <DataCell type="verticalSpeed" value={f.verticalRate} />
                <DataCell type="heading" value={f.track} />
                <td className="px-3 py-1.5 text-center">
                  {aircraftInfo[f.id] ? (
                    <span className="text-green-500 text-xs">✓</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); fetchAircraftInfo(f.id); }}
                      disabled={loading.has(f.id)}
                      className="rounded bg-primary/20 px-2 py-0.5 text-xs text-primary hover:bg-primary/30 disabled:opacity-50"
                    >
                      {loading.has(f.id) ? '...' : 'Info'}
                    </button>
                  )}
                </td>
              </tr>
              {isExpanded && (
                <tr className={isApproaching ? 'bg-green-50 dark:bg-green-950' : ''}>
                  <td colSpan={8} className="px-3 py-3">
                    {aircraftInfo[f.id] != null && (
                      <>
                        <div className="text-xs font-semibold mb-1 text-muted-foreground">Aircraft Metadata</div>
                        <pre className="bg-muted/50 p-3 text-xs font-mono overflow-x-auto rounded mb-2">
                          {JSON.stringify(aircraftInfo[f.id], null, 2)}
                        </pre>
                      </>
                    )}
                    <div className="text-xs font-semibold mb-1 text-muted-foreground">Flight State</div>
                    <pre className="bg-muted/50 p-3 text-xs font-mono overflow-x-auto rounded">
                      {JSON.stringify(f, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
