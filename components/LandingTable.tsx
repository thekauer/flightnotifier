'use client';

import { useMemo } from 'react';
import type { Flight, VisibilityPrediction } from '@/lib/types';
import type { MetarData } from '@/lib/api/weather';
import { getVisibilityLevel, getVisibilityLabel } from '@/lib/api/weather';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { useVisibilityPredictions } from '@/hooks/useVisibilityPredictions';
import { DataCell } from './DataCell';
import { AirportCell } from './AirportCell';
import { VisibilityCountdown } from './VisibilityCountdown';

interface LandingTableProps {
  flights: Flight[];
  weather: MetarData | null;
}

function isRunwayApproach(f: Flight): boolean {
  if (f.onGround || f.alt >= 5000 || f.verticalRate >= 0) return false;
  // RWY 27 approach: heading 260-280
  if (f.track >= 260 && f.track <= 280) return true;
  // RWY 09 approach: heading 77-97
  if (f.track >= 77 && f.track <= 97) return true;
  return false;
}

/** Returns estimated minutes to ground, or Infinity if not calculable */
function estimateEtaMinutes(f: Flight): number {
  if (f.alt <= 0 || f.verticalRate >= 0) return Infinity;
  const minutesToGround = f.alt / Math.abs(f.verticalRate);
  if (minutesToGround > 60 || minutesToGround < 0) return Infinity;
  return minutesToGround;
}


const VIS_STYLES: Record<string, { dot: string; label: string }> = {
  clear: { dot: 'bg-emerald-500', label: 'Visible from ground' },
  partial: { dot: 'bg-amber-500', label: 'Low visibility conditions' },
  obscured: { dot: 'bg-red-500', label: 'Above clouds - not visible' },
};

export function LandingTable({ flights, weather }: LandingTableProps) {
  const { isInZone, zone } = useNotificationZone();
  const { predictions } = useVisibilityPredictions();

  const predictionsByFlightId = useMemo(() => {
    const map = new Map<string, VisibilityPrediction>();
    for (const p of predictions) {
      map.set(p.flightId, p);
    }
    return map;
  }, [predictions]);

  const landingFlights = useMemo(
    () =>
      flights
        .filter(isRunwayApproach)
        .sort((a, b) => {
          const etaA = estimateEtaMinutes(a);
          const etaB = estimateEtaMinutes(b);
          // If both have valid ETAs, sort by ETA ascending (soonest first)
          if (isFinite(etaA) && isFinite(etaB)) return etaA - etaB;
          // If only one has ETA, it goes first
          if (isFinite(etaA)) return -1;
          if (isFinite(etaB)) return 1;
          // Fallback: lowest altitude first
          return a.alt - b.alt;
        }),
    [flights],
  );

  if (landingFlights.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Landing Now
        </h2>
        <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          {landingFlights.length}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Callsign</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">From</th>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">To</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Alt</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Speed</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">V/S</th>
              <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">ETA</th>
              {zone && <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">ETV</th>}
              <th className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Vis</th>
            </tr>
          </thead>
          <tbody>
            {landingFlights.map((f) => {
              const inZone = zone ? isInZone(f.lat, f.lon) : false;
              return (
                <tr
                  key={f.id}
                  className={`border-b border-border/50 transition-colors ${
                    inZone
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-l-3 border-l-blue-500'
                      : 'bg-amber-50/40 dark:bg-amber-950/20'
                  }`}
                >
                  <DataCell type="callsign" value={f.callsign || f.id} isApproaching={true} />
                  <DataCell type="aircraftType" value={f.aircraftType} />
                  <AirportCell icaoCode={f.origin} />
                  <AirportCell icaoCode={f.destination} />
                  <DataCell type="altitude" value={f.alt} />
                  <DataCell type="speed" value={f.speed} />
                  <DataCell type="verticalSpeed" value={f.verticalRate} />
                  <DataCell type="eta" value={estimateEtaMinutes(f)} />
                  {zone && (
                    <VisibilityCountdown prediction={predictionsByFlightId.get(f.id)} />
                  )}
                  {(() => {
                    const level = getVisibilityLevel(f.alt, weather);
                    const style = VIS_STYLES[level];
                    return (
                      <td className="px-3 py-1.5 text-center">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${style.dot}`}
                          title={`${getVisibilityLabel(level)} - ${style.label}`}
                        />
                      </td>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
