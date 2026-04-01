'use client';

import { DEGREE_SIGN } from '@/lib/constants/icons';
import { windArrowRotation, windDirectionName } from './weatherHelpers';

export function WindCompass({ direction, speed, gust }: { direction: number | null; speed: number | null; gust: number | null }) {
  const spd = speed ?? 0;
  return (
    <div className="flex items-center gap-3">
      {/* Compass ring */}
      <div className="relative w-12 h-12 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
        {/* Cardinal tick marks */}
        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 text-[8px] font-bold text-muted-foreground">
          N
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0.5 text-[8px] font-bold text-muted-foreground">
          S
        </span>
        <span className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 text-[8px] font-bold text-muted-foreground">
          W
        </span>
        <span className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 text-[8px] font-bold text-muted-foreground">
          E
        </span>
        {/* Wind arrow */}
        {direction !== null && (
          <div
            className="absolute inset-1 flex items-center justify-center"
            style={{ transform: windArrowRotation(direction) }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-500 dark:text-sky-400" fill="currentColor">
              <path d="M12 2L8 10h3v12h2V10h3L12 2z" />
            </svg>
          </div>
        )}
        {direction === null && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
            VRB
          </div>
        )}
      </div>
      {/* Wind values */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums">{spd}</span>
          <span className="text-xs text-muted-foreground font-medium">kt</span>
        </div>
        {gust != null && gust > spd && (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              G{gust}
            </span>
            <span className="text-xs text-muted-foreground">kt</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {direction !== null ? `${direction}${DEGREE_SIGN} (${windDirectionName(direction)})` : 'Variable'}
        </span>
      </div>
    </div>
  );
}
