'use client';

import dynamic from 'next/dynamic';
import type { AirportCorridorsPayload } from '@/lib/airportCorridors';

const AirportCorridorsMapInner = dynamic(() => import('./AirportCorridorsMapInner'), {
  ssr: false,
});

interface AirportCorridorsMapProps {
  data: AirportCorridorsPayload;
  smoothCorridors: boolean;
  smoothingAmount: number;
}

export function AirportCorridorsMap({ data, smoothCorridors, smoothingAmount }: AirportCorridorsMapProps) {
  return (
    <AirportCorridorsMapInner
      data={data}
      smoothCorridors={smoothCorridors}
      smoothingAmount={smoothingAmount}
    />
  );
}
