'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AirportMovementFilter, AirportMovementTrack } from '@/lib/airportMovements';
import type { CorridorMatchResult } from '@/lib/corridorMatcher';

interface CorridorMatcherExplorerProps {
  airportIdent: string;
  date: string;
  movement: AirportMovementFilter;
  tracks: AirportMovementTrack[];
}

function buildObservedPath(track: AirportMovementTrack): { lat: number; lon: number }[] {
  const takeCount = Math.min(5, Math.max(2, Math.ceil(track.path.length / 3)));
  const points =
    track.movement === 'arrival'
      ? track.path.slice(0, takeCount)
      : track.path.slice(0, takeCount);
  return points.map((point) => ({ lat: point.lat, lon: point.lon }));
}

export function CorridorMatcherExplorer({
  airportIdent,
  date,
  movement,
  tracks,
}: CorridorMatcherExplorerProps) {
  const candidateTracks = useMemo(
    () => tracks.filter((track) => track.movement !== 'unknown' && track.path.length >= 4),
    [tracks],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedTrack = candidateTracks[Math.min(selectedIndex, Math.max(candidateTracks.length - 1, 0))] ?? null;

  const { data, isLoading, error } = useQuery<CorridorMatchResult>({
    queryKey: ['corridorMatch', airportIdent, date, movement, selectedTrack?.icao24, selectedTrack?.firstSeen],
    queryFn: async () => {
      if (!selectedTrack) {
        throw new Error('No track selected');
      }

      const response = await fetch('/api/corridor-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airport: airportIdent,
          date,
          movement: selectedTrack.movement,
          points: buildObservedPath(selectedTrack),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to match corridor');
      }

      return response.json();
    },
    enabled: selectedTrack != null,
    refetchOnWindowFocus: false,
  });

  if (candidateTracks.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
        No classified tracks are available yet for corridor matching.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Corridor Matcher</p>
            <p className="text-sm text-muted-foreground">
              Use the first few observed points from a historical flight and see which corridor template it snaps to.
            </p>
          </div>

          <label className="flex flex-col gap-1 text-sm md:min-w-[360px]">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sample track</span>
            <select
              value={String(selectedIndex)}
              onChange={(event) => setSelectedIndex(Number(event.target.value))}
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            >
              {candidateTracks.slice(0, 40).map((track, index) => (
                <option key={`${track.icao24}-${track.firstSeen}`} value={String(index)}>
                  {track.callsign} · {track.movement} · RWY {track.inferredRunway ?? '—'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Matching observed points to corridors...</div>
      ) : error || !data || !selectedTrack ? (
        <div className="rounded-2xl border bg-card p-4 text-sm text-rose-600 dark:text-rose-400">Failed to match track to corridors.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Observed sample</p>
            <div className="mt-3 space-y-2 text-muted-foreground">
              <div>{selectedTrack.callsign}</div>
              <div>{selectedTrack.movement} · RWY {selectedTrack.inferredRunway ?? '—'}</div>
              <div>{buildObservedPath(selectedTrack).length} observed points</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Best candidates</p>
            <div className="mt-3 space-y-2">
              {data.candidates.map((candidate) => (
                <div key={candidate.corridorId} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>
                      {candidate.movement} · RWY {candidate.inferredRunway ?? '—'}
                    </span>
                    <span>{candidate.confidence}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {candidate.weatherBucket} · {candidate.sampleCount} samples · avg {candidate.averageDistanceKm.toFixed(2)} km
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
