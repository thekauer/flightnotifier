'use client';

import { useActiveAirportTouch } from '@/hooks/useActiveAirportTouch';

export function AirportActivityBridge() {
  useActiveAirportTouch();
  return null;
}
