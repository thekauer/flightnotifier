'use client';

import NumberFlow from '@number-flow/react';

interface VsCellProps {
  value: number;
  /** Render as a <td> table cell (default true) */
  asTableCell?: boolean;
  className?: string;
}

export function VsCell({ value, asTableCell = true, className }: VsCellProps) {
  const isClimbing = value > 50;
  const isDescending = value < -50;

  const content = (
    <div className="flex items-center justify-end gap-1.5">
      <div className="flex flex-col items-end leading-tight">
        {isClimbing || isDescending ? (
          <>
            <NumberFlow
              value={Math.abs(value)}
              format={{ useGrouping: true }}
              willChange
              trend={0}
              className={
                isClimbing
                  ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-red-600 dark:text-red-400 font-medium'
              }
              style={{ fontVariantNumeric: 'tabular-nums' }}
            />
            <span className="text-muted-foreground text-[10px]">ft/m</span>
          </>
        ) : (
          <span className="text-muted-foreground">{'\u2014'}</span>
        )}
      </div>
      {(isClimbing || isDescending) && (
        <span
          className={`inline-flex items-center justify-center rounded-full w-5 h-5 text-xs font-bold ${
            isClimbing
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
          }`}
        >
          {isClimbing ? '\u2191' : '\u2193'}
        </span>
      )}
    </div>
  );

  if (!asTableCell) {
    return content;
  }

  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      {content}
    </td>
  );
}
