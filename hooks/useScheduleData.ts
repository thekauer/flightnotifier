'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ScheduledArrival } from '@/lib/types';

export const SCHEDULE_KEY = ['schedule'] as const;

export function useScheduleData(horizonMinutes: number) {
  const { data: schedule = [], isLoading } = useQuery<ScheduledArrival[]>({
    queryKey: SCHEDULE_KEY,
    queryFn: async () => {
      const res = await fetch('/api/schedule');
      if (!res.ok) {
        throw new Error('Failed to fetch schedule');
      }

      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const arrivals = useMemo(() => {
    if (!Number.isFinite(horizonMinutes) || horizonMinutes <= 0) {
      return schedule;
    }

    return schedule.filter((arrival) => arrival.estimatedMinutes <= horizonMinutes);
  }, [schedule, horizonMinutes]);

  return { arrivals, isLoading };
}
