'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useRunways, type Runway } from '@/hooks/useRunways';
import { buildConePolygon } from '@/lib/approachCone';
import {
  SCHIPHOL_LAT,
  SCHIPHOL_LON,
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

export default function RunwayLabMapInner() {
  const isDark = useIsDarkMode();
  const { data: runways = [], isLoading } = useRunways('EHAM');

  const cones = useMemo(() => buildConesFromRunways(runways), [runways]);
  const strips = useMemo(() => buildRunwayStrips(runways), [runways]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">
        Loading runway data...
      </div>
    );
  }

  return (
    <MapContainer
      center={[SCHIPHOL_LAT, SCHIPHOL_LON]}
      zoom={11}
      minZoom={9}
      maxZoom={16}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        key={isDark ? 'dark' : 'light'}
        attribution={TILE_ATTRIBUTION}
        url={isDark ? TILE_DARK : TILE_LIGHT}
      />

      {/* Approach cones — muted green */}
      {cones.map((cone) => (
        <Polygon
          key={cone.key}
          positions={cone.polygon}
          pathOptions={{
            color: COLOR_CONE,
            fillColor: COLOR_CONE,
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '6 3',
          }}
        />
      ))}

      {/* Runway strips */}
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

      {/* Runway labels */}
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
  );
}
