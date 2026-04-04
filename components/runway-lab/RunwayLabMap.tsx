'use client';

import dynamic from 'next/dynamic';

const RunwayLabMapInner = dynamic(() => import('./RunwayLabMapInner'), { ssr: false });

export function RunwayLabMap() {
  return (
    <div className="h-full w-full">
      <RunwayLabMapInner />
    </div>
  );
}
