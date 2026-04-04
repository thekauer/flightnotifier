'use client';

import type { SelectedRunwayRecord } from '@/lib/runwaySelection';
import dynamic from 'next/dynamic';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

const RunwayLabMapInner = dynamic(() => import('./RunwayLabMapInner'), { ssr: false });

interface RunwayLabMapProps {
  airport: AirportSearchRecord;
  selectedRunways?: SelectedRunwayRecord[];
  interactiveRunways?: boolean;
  hideUnselectedRunways?: boolean;
  dashSelectedRunways?: boolean;
  onRunwaySelect?: (runway: SelectedRunwayRecord) => void;
  className?: string;
}

export function RunwayLabMap({
  airport,
  selectedRunways,
  interactiveRunways,
  hideUnselectedRunways,
  dashSelectedRunways,
  onRunwaySelect,
  className,
}: RunwayLabMapProps) {
  return (
    <div className={className ?? 'h-full w-full'}>
      <RunwayLabMapInner
        airport={airport}
        selectedRunways={selectedRunways}
        interactiveRunways={interactiveRunways}
        hideUnselectedRunways={hideUnselectedRunways}
        dashSelectedRunways={dashSelectedRunways}
        onRunwaySelect={onRunwaySelect}
      />
    </div>
  );
}
