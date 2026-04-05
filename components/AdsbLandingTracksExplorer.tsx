'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AirportMovementFilter, AirportMovementsPayload } from '@/lib/airportMovements';
import { AdsbLandingTracksMap } from '@/components/AdsbLandingTracksMap';
import { AirportCorridorsExplorer } from '@/components/AirportCorridorsExplorer';
import { CorridorMatcherExplorer } from '@/components/CorridorMatcherExplorer';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

const COMPONENT_TIME_ZONE = 'UTC';

function formatAmsDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COMPONENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function getDefaultDate(): string {
  return formatAmsDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

function toggleRunwaySelection(current: string[], runway: string): string[] {
  if (runway === 'ALL') {
    return [];
  }

  return current.includes(runway)
    ? current.filter((value) => value !== runway)
    : [...current, runway].sort((a, b) => a.localeCompare(b));
}

export function AdsbLandingTracksExplorer() {
  const [selectedDate, setSelectedDate] = useState(getDefaultDate);
  const [airportIdent, setAirportIdent] = useState(DEFAULT_AIRPORT.ident);
  const [movement, setMovement] = useState<AirportMovementFilter>('all');
  const [selectedRunways, setSelectedRunways] = useState<string[]>([]);
  const [corridorWindowMinutes, setCorridorWindowMinutes] = useState(20);
  const [smoothCorridors, setSmoothCorridors] = useState(true);
  const [smoothingAmount, setSmoothingAmount] = useState(6);
  const { data, isLoading, error, isFetching } = useQuery<AirportMovementsPayload>({
    queryKey: ['airportMovements', airportIdent, selectedDate, movement],
    queryFn: async () => {
      const params = new URLSearchParams({
        airport: airportIdent,
        date: selectedDate,
        movement,
      });
      const response = await fetch(`/api/airport-movements?${params.toString()}`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch airport movements');
      }

      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const statsLabel = useMemo(() => {
    if (!data) {
      return 'Pick an airport, date, and movement filter to aggregate ADSB-Lol points into reusable aircraft paths.';
    }

    return `${data.aircraftCount} aircraft, ${data.pointCount.toLocaleString()} points`;
  }, [data]);

  const runwayOptions = useMemo(
    () => {
      if (!data) {
        return [];
      }

      const confidentRunwayTracks = data.tracks.filter(
        (track) => track.inferredRunway != null && track.runwayConfidence !== 'low',
      );
      const minimumStableTrackCount = Math.max(3, Math.ceil(confidentRunwayTracks.length * 0.08));
      const runwayCounts = new Map<string, number>();

      for (const track of confidentRunwayTracks) {
        runwayCounts.set(track.inferredRunway!, (runwayCounts.get(track.inferredRunway!) ?? 0) + 1);
      }

      return Array.from(runwayCounts.entries())
        .filter(([, count]) => count >= minimumStableTrackCount)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([runway]) => runway);
    },
    [data],
  );

  const visibleTopMapData = useMemo(() => {
    if (!data) {
      return data;
    }

    const runwayOptionSet = new Set(runwayOptions);
    const tracks = data.tracks.filter((track) => {
      if (track.inferredRunway == null) {
        return true;
      }

      return track.runwayConfidence !== 'low' && runwayOptionSet.has(track.inferredRunway);
    });

    return {
      ...data,
      aircraftCount: tracks.length,
      pointCount: tracks.reduce((sum, track) => sum + track.pointCount, 0),
      counts: {
        arrivals: tracks.filter((track) => track.movement === 'arrival').length,
        departures: tracks.filter((track) => track.movement === 'departure').length,
        unknown: tracks.filter((track) => track.movement === 'unknown').length,
      },
      tracks,
    };
  }, [data, runwayOptions]);

  const filteredData = useMemo(() => {
    if (!visibleTopMapData || selectedRunways.length === 0) {
      return visibleTopMapData;
    }

    const tracks = visibleTopMapData.tracks.filter(
      (track) =>
        track.inferredRunway != null &&
        track.runwayConfidence !== 'low' &&
        selectedRunways.includes(track.inferredRunway),
    );

    return {
      ...visibleTopMapData,
      aircraftCount: tracks.length,
      pointCount: tracks.reduce((sum, track) => sum + track.pointCount, 0),
      counts: {
        arrivals: tracks.filter((track) => track.movement === 'arrival').length,
        departures: tracks.filter((track) => track.movement === 'departure').length,
        unknown: tracks.filter((track) => track.movement === 'unknown').length,
      },
      tracks,
    };
  }, [selectedRunways, visibleTopMapData]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">ADSB-Lol Replay</p>
          <p className="text-sm text-muted-foreground">{statsLabel}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Airport</span>
            <input
              type="text"
              value={airportIdent}
              onChange={(event) => setAirportIdent(event.target.value.toUpperCase())}
              className="h-10 rounded-xl border bg-background px-3 text-sm uppercase"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Movement</span>
            <select
              value={movement}
              onChange={(event) => setMovement(event.target.value as AirportMovementFilter)}
              className="h-10 rounded-xl border bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="arrival">Arrivals</option>
              <option value="departure">Departures</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>
      </div>

      {data && runwayOptions.length > 0 ? (
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Runway filter</p>
              <p className="text-sm text-muted-foreground">
                Applies to the top movement map. Low-confidence runway guesses are hidden from these chips.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedRunways([])}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedRunways.length === 0
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                All runways
              </button>

              {runwayOptions.map((runway) => {
                const isSelected = selectedRunways.includes(runway);
                return (
                  <button
                    key={runway}
                    type="button"
                    onClick={() => setSelectedRunways((current) => toggleRunwaySelection(current, runway))}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background text-foreground'
                    }`}
                  >
                    RWY {runway}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Loading airport movements...
        </div>
      ) : error || !data ? (
        <div className="rounded-2xl border bg-card p-6 text-sm text-rose-600 dark:text-rose-400">
          Failed to load airport movements.
        </div>
      ) : (
        <>
          <AdsbLandingTracksMap
            data={filteredData ?? data}
            smoothTracks={smoothCorridors}
            smoothingAmount={smoothingAmount}
          />
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-medium">Final Approach And Departure Templates</h3>
              <p className="text-sm text-muted-foreground">
                Averaged templates built from the cleaned final-approach or initial-climb segments in the current selection.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Corridor window
                </span>
                <select
                  value={String(corridorWindowMinutes)}
                  onChange={(event) => setCorridorWindowMinutes(Number(event.target.value))}
                  className="h-10 rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="10">10 minutes</option>
                  <option value="20">20 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={smoothCorridors}
                  onChange={(event) => setSmoothCorridors(event.target.checked)}
                  className="size-4"
                />
                <span>Smooth maps</span>
              </label>
              <label className="flex flex-col gap-1 text-sm md:min-w-[220px]">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Smoothing amount
                </span>
                <input
                  type="range"
                  min="2"
                  max="32"
                  step="1"
                  value={String(smoothingAmount)}
                  disabled={!smoothCorridors}
                  onChange={(event) => setSmoothingAmount(Number(event.target.value))}
                  className="h-10"
                />
                <span className="text-xs text-muted-foreground">
                  {smoothingAmount} interpolation steps per segment
                </span>
              </label>
              <p className="text-sm text-muted-foreground">
                Wider windows reveal more of the arrival setup or departure climb before the final runway segment.
              </p>
            </div>
            <AirportCorridorsExplorer
              airportIdent={airportIdent}
              date={selectedDate}
              movement={movement}
              selectedRunways={selectedRunways}
              windowMinutes={corridorWindowMinutes}
              smoothCorridors={smoothCorridors}
              smoothingAmount={smoothingAmount}
            />
          </div>
          <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Grouped by `icao24`, labeled with the latest non-empty callsign we saw for that aircraft, and classified as
            arrival, departure, or unknown based on route and airport-relative geometry.
            {isFetching ? ' Refreshing…' : ''}
          </div>
          <CorridorMatcherExplorer
            airportIdent={airportIdent}
            date={selectedDate}
            movement={movement}
            tracks={data.tracks}
          />
        </>
      )}
    </div>
  );
}
