import { useMemo } from 'react';
import type { LiveFeedFlight } from '../types';

interface FlightListProps {
  flights: LiveFeedFlight[];
  approachingIds: Set<number>;
}

export function FlightList({ flights, approachingIds }: FlightListProps) {
  const airborne = useMemo(
    () =>
      flights
        .filter((f) => !f.onGround)
        .sort((a, b) => a.alt - b.alt),
    [flights],
  );

  if (airborne.length === 0) {
    return <p className="text-sm text-muted-foreground">No airborne flights</p>;
  }

  return (
    <div className="max-h-[400px] overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Flight</th>
            <th className="px-3 py-2 text-left font-medium">Callsign</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Origin</th>
            <th className="px-3 py-2 text-right font-medium">Alt (ft)</th>
            <th className="px-3 py-2 text-right font-medium">Speed (kts)</th>
            <th className="px-3 py-2 text-right font-medium">Heading</th>
          </tr>
        </thead>
        <tbody>
          {airborne.map((f) => {
            const isApproaching = approachingIds.has(f.flightId);
            return (
              <tr
                key={f.flightId}
                className={isApproaching ? 'bg-green-50 dark:bg-green-950' : ''}
              >
                <td className="px-3 py-1.5">
                  {isApproaching && <span className="mr-1">&#9992;</span>}
                  {f.extraInfo?.flight || '-'}
                </td>
                <td className="px-3 py-1.5">{f.callsign}</td>
                <td className="px-3 py-1.5">{f.extraInfo?.type || '-'}</td>
                <td className="px-3 py-1.5">{f.extraInfo?.route?.from || '-'}</td>
                <td className="px-3 py-1.5 text-right">{f.alt.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right">{f.speed}</td>
                <td className="px-3 py-1.5 text-right">{f.track}&deg;</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
