'use client';

import { AppleSixGridCard } from '@/components/ui/apple-six-grid-card';
import type { AircraftSpottingTrait } from '@/lib/aircraftSpottingTraits';
import { cn } from '@/lib/utils';

type AircraftSpottingGridProps = {
  items: AircraftSpottingTrait[];
  className?: string;
  variant?: 'default' | 'popover';
};

export function AircraftSpottingGrid({
  items,
  className,
  variant = 'default',
}: AircraftSpottingGridProps) {
  const isPopover = variant === 'popover';

  return (
    <AppleSixGridCard
      className={cn(
        isPopover ? 'h-[280px] max-w-none bg-card/98 shadow-xl' : 'h-[360px] max-w-3xl bg-card/98 shadow-md',
        className,
      )}
      cellClassName={cn(isPopover ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5')}
      minCellHeight={0}
      dividerInset={isPopover ? 14 : 18}
      dividerThickness={1.5}
    >
      {items.slice(0, 6).map((item, index) => (
        <div
          key={`${item.title}-${index}`}
          className={cn(
            'flex h-full w-full flex-col justify-start rounded-[18px] px-3 py-3 transition-colors',
            item.highlighted && 'bg-accent/70',
          )}
        >
          <div className={cn(
            'font-semibold uppercase tracking-[0.16em] text-muted-foreground',
            isPopover ? 'text-[10px]' : 'text-[11px]',
          )}>
            {item.title}
          </div>
          <div className={cn(
            'mt-2 leading-snug text-foreground',
            isPopover ? 'text-[13px] sm:text-sm' : 'text-sm sm:text-[15px]',
          )}>
            {item.detail ?? ' '}
          </div>
        </div>
      ))}
    </AppleSixGridCard>
  );
}
