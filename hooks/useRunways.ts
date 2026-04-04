'use client';

import { useQuery } from '@tanstack/react-query';

export interface Runway {
  id: number;
  airportRef: number | null;
  airportIdent: string | null;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null;
  lighted: boolean | null;
  closed: boolean | null;
  leIdent: string | null;
  leLatitudeDeg: number | null;
  leLongitudeDeg: number | null;
  leElevationFt: number | null;
  leHeadingDegT: number | null;
  leDisplacedThresholdFt: number | null;
  heIdent: string | null;
  heLatitudeDeg: number | null;
  heLongitudeDeg: number | null;
  heElevationFt: number | null;
  heHeadingDegT: number | null;
  heDisplacedThresholdFt: number | null;
}

export function useRunways(airportIdent: string) {
  return useQuery<Runway[]>({
    queryKey: ['runways', airportIdent],
    queryFn: async () => {
      const res = await fetch(`/api/runways?airport=${encodeURIComponent(airportIdent)}`);
      if (!res.ok) throw new Error('Failed to fetch runways');
      return res.json();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
