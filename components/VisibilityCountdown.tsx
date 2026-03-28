'use client';

import type { VisibilityPrediction } from '@/lib/types';

interface VisibilityCountdownProps {
  prediction: VisibilityPrediction | undefined;
}

const VIS_COLORS: Record<VisibilityPrediction['predictedVisibility'], string> = {
  visible: 'text-emerald-600 dark:text-emerald-400',
  partially_visible: 'text-amber-600 dark:text-amber-400',
  obscured: 'text-red-600 dark:text-red-400',
};

const VIS_BG: Record<VisibilityPrediction['predictedVisibility'], string> = {
  visible: 'bg-emerald-50 dark:bg-emerald-950/40',
  partially_visible: 'bg-amber-50 dark:bg-amber-950/40',
  obscured: 'bg-red-50 dark:bg-red-950/40',
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const VIS_LABEL: Record<VisibilityPrediction['predictedVisibility'], string> = {
  visible: 'visible',
  partially_visible: 'low vis',
  obscured: 'obscured',
};

export function VisibilityCountdown({ prediction }: VisibilityCountdownProps) {
  if (!prediction) {
    return (
      <td className="px-3 py-1.5 text-center text-xs text-muted-foreground">
        —
      </td>
    );
  }

  const { secondsUntilZoneEntry, predictedVisibility, confidence, updatedAt } = prediction;

  // Adjust countdown by elapsed time since the prediction was computed
  const elapsedSeconds = Math.floor((Date.now() - updatedAt) / 1000);
  const adjustedSeconds = Math.max(0, secondsUntilZoneEntry - elapsedSeconds);
  const isNow = adjustedSeconds <= 0;

  const label = VIS_LABEL[predictedVisibility];

  return (
    <td className="px-3 py-1.5 text-center">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VIS_COLORS[predictedVisibility]} ${VIS_BG[predictedVisibility]}`}
        title={`${isNow ? `${label} now` : `${label} in ~${formatCountdown(adjustedSeconds)}`} (${predictedVisibility.replace('_', ' ')}, confidence: ${confidence})`}
      >
        {isNow ? (
          label
        ) : (
          <>
            <span className="tabular-nums">{formatCountdown(adjustedSeconds)}</span>
          </>
        )}
        {confidence === 'low' && <span className="opacity-50">?</span>}
      </span>
    </td>
  );
}
