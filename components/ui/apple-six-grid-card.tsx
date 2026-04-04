'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type AppleSixGridCardProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  cellClassName?: string;
  dividerInset?: number;
  dividerThickness?: number;
  minCellHeight?: number;
  orientation?: 'horizontal' | 'vertical';
  chrome?: 'card' | 'plain';
  columns?: number;
  rows?: number;
};

export function AppleSixGridCard({
  className,
  children,
  cellClassName,
  dividerInset = 16,
  dividerThickness = 1.5,
  minCellHeight = 88,
  orientation = 'horizontal',
  chrome = 'card',
  columns,
  rows,
  style,
  ...props
}: AppleSixGridCardProps) {
  const resolvedColumns = columns ?? (orientation === 'horizontal' ? 3 : 2);
  const resolvedRows = rows ?? (orientation === 'horizontal' ? 2 : 3);
  const slotCount = resolvedColumns * resolvedRows;
  const cells: React.ReactNode[] = React.Children.toArray(children).slice(0, slotCount);

  while (cells.length < slotCount) {
    cells.push(null);
  }

  return (
    <div
      className={cn(
        'relative text-card-foreground',
        chrome === 'card' && [
          'overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm',
          'supports-[backdrop-filter]:bg-card/95',
        ],
        className,
      )}
      style={
        {
          ...style,
          '--apple-grid-divider-inset': `${dividerInset}px`,
          '--apple-grid-divider-thickness': `${dividerThickness}px`,
          '--apple-grid-min-cell-height': `${minCellHeight}px`,
        } as React.CSSProperties
      }
      {...props}
    >
      <div
        className={cn(
          'grid h-full',
        )}
        style={{
          gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${resolvedRows}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, index) => (
          <div
            key={index}
            className={cn(
              'relative flex h-full min-h-[var(--apple-grid-min-cell-height)] items-start justify-start p-5',
              cellClassName,
            )}
          >
            {cell}
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {Array.from({ length: resolvedColumns - 1 }, (_, index) => {
          const left = `${((index + 1) / resolvedColumns) * 100}%`;

          return (
            <span
              key={`vertical-${index}`}
              className="absolute top-[var(--apple-grid-divider-inset)] w-[var(--apple-grid-divider-thickness)] -translate-x-1/2 rounded-full bg-border/80"
              style={{
                left,
                height: 'calc(100% - (var(--apple-grid-divider-inset) * 2))',
              }}
            />
          );
        })}
        {Array.from({ length: resolvedRows - 1 }, (_, index) => {
          const top = `${((index + 1) / resolvedRows) * 100}%`;

          return (
            <span
              key={`horizontal-${index}`}
              className="absolute left-[var(--apple-grid-divider-inset)] h-[var(--apple-grid-divider-thickness)] -translate-y-1/2 rounded-full bg-border/80"
              style={{
                top,
                width: 'calc(100% - (var(--apple-grid-divider-inset) * 2))',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
