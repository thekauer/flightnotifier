'use client';

import type { CloudLayer } from '@/lib/api/weather';
import { cloudCoverPercent, cloudCoverLabel } from './weatherHelpers';

export function CloudLayerBar({ layer }: { layer: CloudLayer }) {
  const pct = cloudCoverPercent(layer.cover);
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
        {layer.base.toLocaleString()} ft
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-400/70 dark:bg-sky-500/50 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{cloudCoverLabel(layer.cover)}</span>
    </div>
  );
}
