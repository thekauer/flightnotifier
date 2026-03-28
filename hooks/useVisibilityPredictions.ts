'use client';

import { useQuery } from '@tanstack/react-query';
import type { VisibilityPrediction } from '@/lib/types';

const PREDICTIONS_KEY = ['visibilityPredictions'] as const;

const EMPTY_PREDICTIONS: VisibilityPrediction[] = [];

/**
 * Reads visibility predictions from the query cache.
 * Predictions are written to the cache by useFlightEvents when it receives
 * 'visibility_predictions' SSE events.
 */
export function useVisibilityPredictions() {
  const { data: predictions = EMPTY_PREDICTIONS } = useQuery<VisibilityPrediction[]>({
    queryKey: PREDICTIONS_KEY,
    queryFn: () => EMPTY_PREDICTIONS,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: false, // Only populated via SSE
  });

  return { predictions };
}

export { PREDICTIONS_KEY };
