'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { FlightState } from '@/lib/types';

const FlightMapInner = dynamic(() => import('./FlightMapInner'), { ssr: false });

interface FlightMapProps {
  state: FlightState;
}

export function FlightMap({ state }: FlightMapProps) {
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.id)),
    [state.approachingFlights],
  );

  const airborneFlights = useMemo(
    () => state.allFlights.filter((f) => !f.onGround),
    [state.allFlights],
  );

  return <FlightMapInner airborneFlights={airborneFlights} approachingIds={approachingIds} />;
}
