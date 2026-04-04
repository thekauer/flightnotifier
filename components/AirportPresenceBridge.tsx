'use client';

import { useAirportPresence } from '@/hooks/useAirportPresence';

export function AirportPresenceBridge() {
  useAirportPresence();
  return null;
}
