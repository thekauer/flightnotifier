'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_LIGHT } from '@/components/flight-map/mapConstants';
import type { AirportMovementTrack, AirportMovementsPayload } from '@/lib/airportMovements';
import { smoothPolyline } from '@/lib/mapSmoothing';

function movementColor(track: AirportMovementTrack): string {
  if (track.movement === 'arrival') {
    return '#2563eb';
  }
  if (track.movement === 'departure') {
    return '#dc2626';
  }
  return '#64748b';
}

function FitToTracks({
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

interface AdsbLandingTracksMapInnerProps {
  data: AirportMovementsPayload;
  smoothTracks: boolean;
  smoothingAmount: number;
}

export default function AdsbLandingTracksMapInner({
  data,
  smoothTracks,
  smoothingAmount,
}: AdsbLandingTracksMapInnerProps) {
  const airportCenter = useMemo<[number, number]>(
    () => [data.airportLatitude, data.airportLongitude],
    [data.airportLatitude, data.airportLongitude],
  );
  const renderedTracks = useMemo(
    () =>
      data.tracks.map((track) => {
        const points = track.path.map((point) => [point.lat, point.lon] as [number, number]);
        return {
          ...track,
          renderedPath: smoothTracks ? smoothPolyline(points, smoothingAmount) : points,
        };
      }),
    [data.tracks, smoothTracks, smoothingAmount],
  );
  const allPoints = useMemo<[number, number][]>(
    () => renderedTracks.flatMap((track) => track.renderedPath),
    [renderedTracks],
  );

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-[620px] w-full">
          <MapContainer center={airportCenter} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_LIGHT} />
            <FitToTracks airportCenter={airportCenter} points={allPoints} />

            {data.runwayGeometry.map((runway) => (
              <Polyline
                key={`${runway.leIdent}-${runway.heIdent}`}
                positions={[runway.le, runway.he]}
                pathOptions={{ color: '#0f172a', opacity: 0.8, weight: 6 }}
              >
                <Tooltip permanent direction="center" className="runway-label">
                  {runway.leIdent}/{runway.heIdent}
                </Tooltip>
              </Polyline>
            ))}

            {renderedTracks.map((track) => (
                <Polyline
                  key={`${track.icao24}-${track.firstSeen}`}
                  positions={track.renderedPath}
                  pathOptions={{
                    color: movementColor(track),
                    opacity: 0.4,
                    weight: 2.2,
                  }}
                >
                  <Tooltip sticky>
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold">{track.callsign}</div>
                      <div>{track.icao24.toUpperCase()}</div>
                      <div>{track.movement} · {track.movementConfidence}</div>
                      <div>RWY {track.inferredRunway ?? '—'} · {track.runwayConfidence}</div>
                      <div>
                        Wind {track.weather?.windDirection ?? '—'} / {track.weather?.windSpeed ?? '—'} kt
                      </div>
                      <div>{track.pointCount} points</div>
                      <div>
                        {new Date(track.firstSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {new Date(track.lastSeen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </Tooltip>
              </Polyline>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Airport</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{data.airportIdent}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.airportName ?? 'Unknown airport'}</p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Selected date</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{data.date}</p>
          <p className="mt-1 text-sm text-muted-foreground">{data.timezone}</p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Aircraft</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{data.aircraftCount}</p>
        </div>

        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Points</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">{data.pointCount.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Arrivals</span>
            <span>{data.counts.arrivals}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Departures</span>
            <span>{data.counts.departures}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Unknown</span>
            <span>{data.counts.unknown}</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          Each track now carries the nearest METAR snapshot, so runway and corridor models can later factor in wind,
          ceiling, and visibility instead of learning from geometry alone.
        </div>
      </div>
    </div>
  );
}
