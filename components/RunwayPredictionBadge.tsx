'use client';

import type { RunwayPrediction } from '@/lib/types';

interface RunwayPredictionBadgeProps {
  prediction: RunwayPrediction;
}

function confidenceColor(confidence: RunwayPrediction['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    case 'low':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

export function RunwayPredictionBadge({ prediction }: RunwayPredictionBadgeProps) {
  const pct = Math.round(prediction.probability * 100);
  const colors = confidenceColor(prediction.confidence);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
      title={`RWY ${prediction.runway} — ${pct}% probability (${prediction.confidence} confidence)\nWind: ${Math.round(prediction.signals.wind * 100)}% | History: ${Math.round(prediction.signals.history * 100)}% | Time: ${Math.round(prediction.signals.timeOfDay * 100)}% | Active: ${Math.round(prediction.signals.activeConfig * 100)}%`}
    >
      <span>{prediction.runway}</span>
      <span className="opacity-70">{pct}%</span>
    </span>
  );
}
