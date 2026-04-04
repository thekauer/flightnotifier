'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { MapContainer, Marker, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useRunways, type Runway } from '@/hooks/useRunways';
import type { AirportSearchRecord } from '@/lib/airport-catalog';
import { buildConePolygon } from '@/lib/buildConePolygon';
import {
  TILE_LIGHT,
  TILE_DARK,
  TILE_ATTRIBUTION,
  COLOR_CONE,
  FT_TO_M,
  M_PER_DEG_LAT,
  RUNWAY_WIDTH_SCALE,
} from '@/components/flight-map/mapConstants';

// ---------------------------------------------------------------------------
// Dark mode (same pattern as FlightMapInner)
// ---------------------------------------------------------------------------

function subscribeToDarkMode(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

function getIsDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

function getIsDarkServer(): boolean {
  return true;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeToDarkMode, getIsDark, getIsDarkServer);
}

// ---------------------------------------------------------------------------
// Cone parameters (match existing Buitenveldertbaan cones)
// ---------------------------------------------------------------------------

const CONE_HALF_ANGLE_DEG = 6;
const CONE_LENGTH_M = 28_000;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function runwayPolygon(le: [number, number], he: [number, number], widthFt: number): [number, number][] {
  const halfWidthM = (widthFt * FT_TO_M) / 2;
  const dLat = he[0] - le[0];
  const dLon = he[1] - le[1];
  const midLat = (le[0] + he[0]) / 2;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);
  const dLatM = dLat * M_PER_DEG_LAT;
  const dLonM = dLon * mPerDegLon;
  const length = Math.sqrt(dLatM * dLatM + dLonM * dLonM);
  const perpLatM = dLonM / length;
  const perpLonM = -dLatM / length;
  const offsetLat = (perpLatM * halfWidthM) / M_PER_DEG_LAT;
  const offsetLon = (perpLonM * halfWidthM) / mPerDegLon;
  return [
    [le[0] + offsetLat, le[1] + offsetLon],
    [le[0] - offsetLat, le[1] - offsetLon],
    [he[0] - offsetLat, he[1] - offsetLon],
    [he[0] + offsetLat, he[1] + offsetLon],
  ];
}

interface ConeData {
  key: string;
  polygon: [number, number][];
}

function buildConesFromRunways(runways: Runway[]): ConeData[] {
  const cones: ConeData[] = [];

  for (const rwy of runways) {
    // LE approach cone: planes land heading le_heading, so they approach from the reciprocal
    if (rwy.leLatitudeDeg != null && rwy.leLongitudeDeg != null && rwy.leHeadingDegT != null) {
      const approachBearing = (rwy.leHeadingDegT + 180) % 360;
      cones.push({
        key: `${rwy.id}-le-${rwy.leIdent}`,
        polygon: buildConePolygon({
          threshold: [rwy.leLatitudeDeg, rwy.leLongitudeDeg],
          approachBearing,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }

    // HE approach cone
    if (rwy.heLatitudeDeg != null && rwy.heLongitudeDeg != null && rwy.heHeadingDegT != null) {
      const approachBearing = (rwy.heHeadingDegT + 180) % 360;
      cones.push({
        key: `${rwy.id}-he-${rwy.heIdent}`,
        polygon: buildConePolygon({
          threshold: [rwy.heLatitudeDeg, rwy.heLongitudeDeg],
          approachBearing,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }
  }

  return cones;
}

interface RunwayStripData {
  key: string;
  corners: [number, number][];
  leIdent: string;
  heIdent: string;
  le: [number, number];
  he: [number, number];
}

function buildRunwayStrips(runways: Runway[]): RunwayStripData[] {
  const strips: RunwayStripData[] = [];

  for (const rwy of runways) {
    if (
      rwy.leLatitudeDeg == null || rwy.leLongitudeDeg == null ||
      rwy.heLatitudeDeg == null || rwy.heLongitudeDeg == null ||
      rwy.widthFt == null
    ) continue;

    const le: [number, number] = [rwy.leLatitudeDeg, rwy.leLongitudeDeg];
    const he: [number, number] = [rwy.heLatitudeDeg, rwy.heLongitudeDeg];

    strips.push({
      key: `strip-${rwy.id}`,
      corners: runwayPolygon(le, he, rwy.widthFt * RUNWAY_WIDTH_SCALE),
      leIdent: rwy.leIdent ?? '',
      heIdent: rwy.heIdent ?? '',
      le,
      he,
    });
  }

  return strips;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MapViewportController({
  center,
  strips,
}: {
  center: [number, number];
  strips: RunwayStripData[];
}) {
  const map = useMap();

  useEffect(() => {
    if (strips.length > 0) {
      const points = strips.flatMap((strip) => strip.corners);
      map.fitBounds(points, {
        padding: [48, 48],
        maxZoom: 13,
        animate: true,
        duration: 1.2,
      });
      return;
    }

    map.flyTo(center, 11, {
      animate: true,
      duration: 1.2,
    });
  }, [center, map, strips]);

  return null;
}

export default function RunwayLabMapInner({ airport }: { airport: AirportSearchRecord }) {
  const isDark = useIsDarkMode();
  const { data: runways = [], isLoading } = useRunways(airport.ident);
  const [hoveredConeKey, setHoveredConeKey] = useState<string | null>(null);

  const cones = useMemo(() => buildConesFromRunways(runways), [runways]);
  const strips = useMemo(() => buildRunwayStrips(runways), [runways]);
  const center = useMemo<[number, number]>(() => [airport.latitude, airport.longitude], [airport.latitude, airport.longitude]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={center}
        zoom={11}
        minZoom={3}
        maxZoom={16}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          attribution={TILE_ATTRIBUTION}
          url={isDark ? TILE_DARK : TILE_LIGHT}
        />

        <MapViewportController center={center} strips={strips} />

        {cones.map((cone) => (
          <Polygon
            key={cone.key}
            positions={cone.polygon}
            eventHandlers={{
              mouseover: () => setHoveredConeKey(cone.key),
              mouseout: () => setHoveredConeKey((current) => (current === cone.key ? null : current)),
            }}
            pathOptions={{
              color: COLOR_CONE,
              fillColor: COLOR_CONE,
              fillOpacity: hoveredConeKey === cone.key ? 0.14 : 0,
              opacity: hoveredConeKey === cone.key ? 1 : 0.45,
              weight: hoveredConeKey === cone.key ? 2 : 1,
              dashArray: hoveredConeKey === cone.key ? undefined : '6 3',
            }}
          />
        ))}

        {strips.map((strip) => (
          <Polygon
            key={strip.key}
            positions={strip.corners}
            pathOptions={{
              color: isDark ? '#a1a1aa' : '#555',
              fillColor: isDark ? '#71717a' : '#333',
              fillOpacity: 0.7,
              weight: 1,
            }}
          />
        ))}

        {strips.map((strip) => (
          <React.Fragment key={`lbl-${strip.key}`}>
            <Marker position={strip.le} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
              <Tooltip permanent direction="center" className="runway-label">
                {strip.leIdent}
              </Tooltip>
            </Marker>
            <Marker position={strip.he} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
              <Tooltip permanent direction="center" className="runway-label">
                {strip.heIdent}
              </Tooltip>
            </Marker>
          </React.Fragment>
        ))}
      </MapContainer>

      {isLoading ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-full border border-black/8 bg-white/88 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
          Loading runway data for {airport.ident}...
        </div>
      ) : null}

      {!isLoading && strips.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-2xl border border-black/8 bg-white/88 px-4 py-3 text-sm text-muted-foreground shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
          No runway geometry was found for {airport.ident}, so the map is centered on the airport only.
        </div>
      ) : null}
    </div>
  );
}
