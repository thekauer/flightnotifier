'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_LIGHT } from '@/components/flight-map/mapConstants';
import type { AirportCorridor, AirportCorridorsPayload } from '@/lib/airportCorridors';
import { smoothPolyline } from '@/lib/mapSmoothing';

function corridorColor(corridor: AirportCorridor): string {
  if (corridor.movement === 'arrival') {
    return '#0f766e';
  }
  if (corridor.movement === 'departure') {
    return '#b91c1c';
  }
  return '#475569';
}

function FitToCorridors({
  airportCenter,
  points,
}: { airportCenter: [number, number]; points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [24, 24] });
      return;
    }

    map.setView(airportCenter, 11);
  }, [airportCenter, map, points]);

  return null;
}

interface AirportCorridorsMapInnerProps {
  data: AirportCorridorsPayload;
  smoothCorridors: boolean;
  smoothingAmount: number;
}

export default function AirportCorridorsMapInner({
  data,
  smoothCorridors,
  smoothingAmount,
}: AirportCorridorsMapInnerProps) {
  const airportCenter = useMemo<[number, number]>(
    () => [data.airportLatitude, data.airportLongitude],
    [data.airportLatitude, data.airportLongitude],
  );
  const smoothedCorridors = useMemo(
    () =>
      data.corridors.map((corridor) => ({
        ...corridor,
        smoothedPath: smoothPolyline(
          corridor.averagePath.map((point) => [point.lat, point.lon] as [number, number]),
          smoothingAmount,
        ),
      })),
    [data.corridors, smoothingAmount],
  );
  const allPoints = useMemo<[number, number][]>(
    () => smoothedCorridors.flatMap((corridor) => corridor.smoothedPath),
    [smoothedCorridors],
  );

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-[620px] w-full">
          <MapContainer center={airportCenter} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_LIGHT} />
            <FitToCorridors airportCenter={airportCenter} points={allPoints} />

            {data.runwayGeometry.map((runway) => (
              <Polyline
                key={`${runway.leIdent}-${runway.heIdent}`}
                positions={[runway.le, runway.he]}
                pathOptions={{ color: '#111827', opacity: 0.85, weight: 6 }}
              >
                <Tooltip permanent direction="center" className="runway-label">
                  {runway.leIdent}/{runway.heIdent}
                </Tooltip>
              </Polyline>
            ))}

            {smoothedCorridors.map((corridor) => (
              <Polyline
                key={corridor.id}
                positions={
                  smoothCorridors
                    ? corridor.smoothedPath
                    : corridor.averagePath.map((point) => [point.lat, point.lon] as [number, number])
                }
                pathOptions={{
                  color: corridorColor(corridor),
                  opacity: 0.78,
                  weight: Math.min(8, 2 + corridor.sampleCount * 0.35),
                }}
              >
                <Tooltip sticky>
                  <div className="space-y-1 text-xs">
                    <div className="font-semibold">{corridor.movement} corridor</div>
                    <div>RWY {corridor.inferredRunway ?? '—'}</div>
                    <div>{corridor.sampleCount} samples</div>
                    <div>{corridor.weatherBucket}</div>
                    <div>{corridor.sampleCallsigns.join(', ') || 'No callsigns'}</div>
                  </div>
                </Tooltip>
              </Polyline>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Corridors</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{data.corridorCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Built from {data.sourceTrackCount} source tracks using the last {data.windowMinutes} airborne minutes before arrival
            or the first {data.windowMinutes} airborne minutes after departure.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Top templates</p>
          <div className="mt-3 space-y-2">
            {data.corridors.slice(0, 8).map((corridor) => (
              <div key={corridor.id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{corridor.movement} · RWY {corridor.inferredRunway ?? '—'}</span>
                  <span>{corridor.sampleCount}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{corridor.weatherBucket}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          These templates are averaged from cleaned flight segments, not full-day aircraft traces: final approach into
          the runway for arrivals, and initial climb-out from the runway for departures.
        </div>
      </div>
    </div>
  );
}
