'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ScheduledArrival } from '@/lib/types';

export const getScheduleKey = (airportIdent: string) => ['schedule', airportIdent] as const;

export function useScheduleData(horizonMinutes: number, airportIdent: string) {
  const { data: schedule = [], isLoading } = useQuery<ScheduledArrival[]>({
    queryKey: getScheduleKey(airportIdent),
    queryFn: async () => {
      const res = await fetch(`/api/schedule?airport=${encodeURIComponent(airportIdent)}`);
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
