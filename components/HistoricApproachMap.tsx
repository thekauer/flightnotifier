'use client';

import dynamic from 'next/dynamic';
import type { HistoricalFlightPath } from '@/lib/types';

const HistoricApproachMapInner = dynamic(() => import('./HistoricApproachMapInner'), {
  ssr: false,
});

interface HistoricApproachMapProps {
  history: HistoricalFlightPath;
}

export function HistoricApproachMap({ history }: HistoricApproachMapProps) {
  return <HistoricApproachMapInner history={history} />;
}
