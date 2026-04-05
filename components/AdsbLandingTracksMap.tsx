'use client';

import dynamic from 'next/dynamic';
import type { AirportMovementsPayload } from '@/lib/airportMovements';

const AdsbLandingTracksMapInner = dynamic(() => import('./AdsbLandingTracksMapInner'), {
  ssr: false,
});

interface AdsbLandingTracksMapProps {
  data: AirportMovementsPayload;
  smoothTracks: boolean;
  smoothingAmount: number;
}

export function AdsbLandingTracksMap({ data, smoothTracks, smoothingAmount }: AdsbLandingTracksMapProps) {
  return (
    <AdsbLandingTracksMapInner
      data={data}
      smoothTracks={smoothTracks}
      smoothingAmount={smoothingAmount}
    />
  );
}
