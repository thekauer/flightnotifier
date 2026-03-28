'use client';

import type { MetarData } from '@/lib/api/weather';
import { getVisibilityLevel, getVisibilityLabel, type VisibilityLevel } from '@/lib/api/weather';

interface VisibilityBadgeProps {
  altitudeFt: number;
  weather: MetarData | null | undefined;
}

function badgeClasses(level: VisibilityLevel): string {
  switch (level) {
    case 'clear':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
    case 'partial':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
    case 'obscured':
      return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
  }
}

export function VisibilityBadge({ altitudeFt, weather }: VisibilityBadgeProps) {
  if (!weather) return null;

  const level = getVisibilityLevel(altitudeFt, weather);

  // Don't show badge when conditions are clear — saves visual clutter
  if (level === 'clear') return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses(level)}`}
      title={`Ceiling: ${weather.ceiling ?? 'none'} ft, Visibility: ${weather.visibility ?? '?'} SM`}
    >
      {level === 'obscured' && (
        <svg className="mr-1 h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2C4 2 1 8 1 8s3 6 7 6 7-6 7-6-3-6-7-6zm0 10a4 4 0 110-8 4 4 0 010 8z" opacity="0.3" />
          <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
      {getVisibilityLabel(level)}
    </span>
  );
}
