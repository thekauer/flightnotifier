'use client';

import dynamic from 'next/dynamic';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

const RunwayLabMapInner = dynamic(() => import('./RunwayLabMapInner'), { ssr: false });

interface RunwayLabMapProps {
  airport: AirportSearchRecord;
}

export function RunwayLabMap({ airport }: RunwayLabMapProps) {
  return (
    <div className="h-full w-full">
      <RunwayLabMapInner airport={airport} />
    </div>
  );
}
