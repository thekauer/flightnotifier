'use client';

import React, { useMemo, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import NumberFlow from '@number-flow/react';
import type { Flight } from '@/lib/types';
import { useNotificationZone, type ZoneBounds } from '@/lib/notificationZoneContext';
import { APPROACH_CONE_27 } from '@/lib/approachCone';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { VsCell } from './VsCell';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
const COLOR_APPROACHING = '#16a34a';    // green — flights in approach cone
const COLOR_DEFAULT = '#2563eb';        // blue — normal flights
const COLOR_SELECTED = '#f59e0b';       // amber — selected aircraft
const COLOR_IN_ZONE = '#a855f7';        // purple — aircraft inside notification zone
const COLOR_CONE = '#16a34a';           // green — approach cone overlay
const COLOR_RUNWAY_FILL_LIGHT = '#333';
const COLOR_RUNWAY_FILL_DARK = '#71717a';
const COLOR_RUNWAY_STROKE_LIGHT = '#555';
const COLOR_RUNWAY_STROKE_DARK = '#a1a1aa';
const COLOR_ZONE_BORDER = '#3b82f6';    // blue — notification zone rectangle

/** Tile URLs for light and dark themes (CartoDB free tiles). */
const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Subscribe to dark-mode class changes on <html> via MutationObserver.
 * Used with useSyncExternalStore so the map tiles react to theme switches.
 */
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

/** Server snapshot — default to dark (matches the app default). */
function getIsDarkServer(): boolean {
  return true;
}

function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribeToDarkMode, getIsDark, getIsDarkServer);
}

const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];

/**
 * EHAM runway data from OurAirports.
 * Each runway is defined by low-end (LE) and high-end (HE) coordinates plus width in feet.
 */
const EHAM_RUNWAYS: {
  le: [number, number]; // [lat, lon]
  he: [number, number];
  widthFt: number;
  leIdent: string;
  heIdent: string;
}[] = [
  { le: [52.30040, 4.78348], he: [52.31400, 4.80302], widthFt: 148, leIdent: '04', heIdent: '22' },
  { le: [52.28790, 4.73402], he: [52.30460, 4.77752], widthFt: 148, leIdent: '06', heIdent: '24' },
  { le: [52.31660, 4.74635], he: [52.31840, 4.79689], widthFt: 148, leIdent: '09', heIdent: '27' },
  { le: [52.33140, 4.74003], he: [52.30180, 4.73750], widthFt: 148, leIdent: '18C', heIdent: '36C' },
  { le: [52.32130, 4.77996], he: [52.29080, 4.77735], widthFt: 148, leIdent: '18L', heIdent: '36R' },
  { le: [52.36270, 4.71193], he: [52.32860, 4.70884], widthFt: 198, leIdent: '18R', heIdent: '36L' },
];

/** Convert feet to meters. */
const FT_TO_M = 0.3048;

/** Metres per degree of latitude (roughly constant). */
const M_PER_DEG_LAT = 111_320;

/**
 * Compute the 4 corners of a runway rectangle from its centerline endpoints and width.
 * Returns corners in order suitable for a Leaflet Polygon: LE-left, LE-right, HE-right, HE-left.
 */
function runwayPolygon(
  le: [number, number],
  he: [number, number],
  widthFt: number,
): [number, number][] {
  const halfWidthM = (widthFt * FT_TO_M) / 2;

  // Direction vector from LE to HE
  const dLat = he[0] - le[0];
  const dLon = he[1] - le[1];

  // Perpendicular unit vector (rotated 90 degrees clockwise)
  // We need to work in meters for correct proportions
  const midLat = (le[0] + he[0]) / 2;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);

  const dLatM = dLat * M_PER_DEG_LAT;
  const dLonM = dLon * mPerDegLon;
  const length = Math.sqrt(dLatM * dLatM + dLonM * dLonM);

  // Perpendicular direction (rotate 90 deg): (dy, -dx) normalized
  const perpLatM = dLonM / length;
  const perpLonM = -dLatM / length;

  // Convert perpendicular offset back to degrees
  const offsetLat = (perpLatM * halfWidthM) / M_PER_DEG_LAT;
  const offsetLon = (perpLonM * halfWidthM) / mPerDegLon;

  return [
    [le[0] + offsetLat, le[1] + offsetLon],
    [le[0] - offsetLat, le[1] - offsetLon],
    [he[0] - offsetLat, he[1] - offsetLon],
    [he[0] + offsetLat, he[1] + offsetLon],
  ];
}

/** Visual width multiplier — real runways are too thin to see clearly on the map. */
const RUNWAY_WIDTH_SCALE = 4;

/** Pre-compute all runway polygons (static data, never changes). */
const EHAM_RUNWAY_POLYGONS = EHAM_RUNWAYS.map((rwy) => ({
  ...rwy,
  corners: runwayPolygon(rwy.le, rwy.he, rwy.widthFt * RUNWAY_WIDTH_SCALE),
}));

/**
 * Classify ICAO type code into an aircraft size category.
 */
type AircraftCategory = 'four-engine' | 'widebody' | 'narrowbody' | 'regional' | 'default';

const FOUR_ENGINE = new Set([
  'A388', 'A389',                           // A380
  'B744', 'B748',                           // 747
  'A342', 'A343', 'A344', 'A345', 'A346',  // A340
]);

const WIDEBODY = new Set([
  'A332', 'A333', 'A338', 'A339',          // A330
  'A359', 'A35K',                           // A350
  'B772', 'B773', 'B77W', 'B77L',          // 777
  'B788', 'B789', 'B78X',                  // 787
  'A306', 'A30B', 'A310',                  // A300/A310
  'B762', 'B763', 'B764',                  // 767
  'IL96', 'MD11', 'DC10',                  // Others
]);

const NARROWBODY = new Set([
  'A318', 'A319', 'A320', 'A321', 'A19N', 'A20N', 'A21N', // A320 family
  'B733', 'B734', 'B735', 'B736', 'B737', 'B738', 'B739', // 737 classic/NG
  'B38M', 'B39M', 'B3XM',                                   // 737 MAX
  'BCS1', 'BCS3', 'A223',                                   // A220/CS
  'E170', 'E175', 'E190', 'E195', 'E290', 'E295',         // Embraer E-Jet
  'B752', 'B753',                                            // 757
  'MD80', 'MD81', 'MD82', 'MD83', 'MD87', 'MD88', 'MD90',  // MD-80/90
]);

const REGIONAL = new Set([
  'AT43', 'AT45', 'AT72', 'AT76',                          // ATR
  'DH8A', 'DH8B', 'DH8C', 'DH8D',                        // Dash 8
  'CRJ1', 'CRJ2', 'CRJ7', 'CRJ9', 'CRJX',               // CRJ
  'E135', 'E145',                                           // Embraer regional
  'SF34', 'SB20', 'JS41', 'F50', 'F70', 'F100',           // Other regional
]);

function classifyAircraft(typeCode: string | null | undefined): AircraftCategory {
  if (!typeCode) return 'default';
  const code = typeCode.trim().toUpperCase();
  if (FOUR_ENGINE.has(code)) return 'four-engine';
  if (WIDEBODY.has(code)) return 'widebody';
  if (NARROWBODY.has(code)) return 'narrowbody';
  if (REGIONAL.has(code)) return 'regional';
  return 'default';
}

/**
 * Top-down airplane SVGs pointing north (up). Rotated by track heading.
 * Each returns an SVG string with the given fill color, sized for its category.
 */
function aircraftSvg(category: AircraftCategory, color: string): { svg: string; size: number } {
  switch (category) {
    case 'four-engine':
      // Large 4-engine silhouette (A380/747 style) - wide wings, 4 engine pods
      return {
        size: 28,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
          <g fill="${color}">
            <!-- fuselage -->
            <rect x="12.5" y="1" width="3" height="26" rx="1.5"/>
            <!-- wings -->
            <polygon points="14,10 1,15 1,16.5 14,13"/>
            <polygon points="14,10 27,15 27,16.5 14,13"/>
            <!-- tail -->
            <polygon points="14,24 6,27 6,26 14,23"/>
            <polygon points="14,24 22,27 22,26 14,23"/>
            <!-- 4 engines -->
            <rect x="3.5" y="12.5" width="1.8" height="4" rx="0.9"/>
            <rect x="7" y="11" width="1.8" height="4" rx="0.9"/>
            <rect x="19.2" y="11" width="1.8" height="4" rx="0.9"/>
            <rect x="22.7" y="12.5" width="1.8" height="4" rx="0.9"/>
          </g>
        </svg>`,
      };
    case 'widebody':
      // Wide-body twin (777/A330 style) - broad wings, 2 large engines
      return {
        size: 24,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <g fill="${color}">
            <!-- fuselage -->
            <rect x="10.5" y="1" width="3" height="22" rx="1.5"/>
            <!-- wings -->
            <polygon points="12,8 1,13 1,14.5 12,11"/>
            <polygon points="12,8 23,13 23,14.5 12,11"/>
            <!-- tail -->
            <polygon points="12,20 5.5,23 5.5,22 12,19.5"/>
            <polygon points="12,20 18.5,23 18.5,22 12,19.5"/>
            <!-- 2 engines -->
            <rect x="5.5" y="10" width="2" height="3.5" rx="1"/>
            <rect x="16.5" y="10" width="2" height="3.5" rx="1"/>
          </g>
        </svg>`,
      };
    case 'narrowbody':
      // Narrow-body twin (A320/737 style) - shorter wings, smaller engines
      return {
        size: 20,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
          <g fill="${color}">
            <!-- fuselage -->
            <rect x="8.5" y="1" width="3" height="18" rx="1.5"/>
            <!-- wings -->
            <polygon points="10,7 1,11 1,12.2 10,9.5"/>
            <polygon points="10,7 19,11 19,12.2 10,9.5"/>
            <!-- tail -->
            <polygon points="10,16.5 5,19 5,18 10,16"/>
            <polygon points="10,16.5 15,19 15,18 10,16"/>
            <!-- 2 engines -->
            <rect x="4.5" y="9" width="1.5" height="3" rx="0.75"/>
            <rect x="14" y="9" width="1.5" height="3" rx="0.75"/>
          </g>
        </svg>`,
      };
    case 'regional':
      // Small regional/turboprop - straight high wing, no visible engines
      return {
        size: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
          <g fill="${color}">
            <!-- fuselage -->
            <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
            <!-- wings (straight, high) -->
            <rect x="0.5" y="5.5" width="15" height="1.8" rx="0.9"/>
            <!-- tail -->
            <polygon points="8,13 4,15.5 4,14.5 8,12.5"/>
            <polygon points="8,13 12,15.5 12,14.5 8,12.5"/>
          </g>
        </svg>`,
      };
    default:
      // Small generic dot-like plane
      return {
        size: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
          <g fill="${color}">
            <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
            <rect x="1" y="6" width="14" height="1.5" rx="0.75"/>
            <polygon points="8,13 4.5,15.5 4.5,14.5 8,12.5"/>
            <polygon points="8,13 11.5,15.5 11.5,14.5 8,12.5"/>
          </g>
        </svg>`,
      };
  }
}

function createFlightIcon(track: number, isApproaching: boolean, aircraftType?: string | null, isInZone?: boolean): L.DivIcon {
  const color = isInZone ? COLOR_IN_ZONE : isApproaching ? COLOR_APPROACHING : COLOR_DEFAULT;
  const category = classifyAircraft(aircraftType);
  const { svg, size } = aircraftSvg(category, color);
  const half = size / 2;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${track}deg);line-height:0;">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    className: '',
  });
}

/**
 * Shorten an ICAO type code by stripping the leading letter.
 * E.g. "B738" → "738", "A320" → "320", "E190" → "190".
 * If null/empty, returns "?".
 */
function shortenTypeCode(typeCode: string | null | undefined): string {
  if (!typeCode) return '?';
  const trimmed = typeCode.trim();
  if (trimmed.length === 0) return '?';
  // Strip leading letter if first char is a letter
  if (/^[A-Za-z]/.test(trimmed)) return trimmed.slice(1);
  return trimmed;
}

/**
 * Create a label-mode icon: an outline triangle pointing in the direction of
 * flight, with the shortened type code displayed below it. The triangle rotates
 * with the heading but the text is counter-rotated to stay upright.
 */
function createLabelIcon(
  track: number,
  aircraftType: string | null | undefined,
  isApproaching: boolean,
  isSelected: boolean,
  isInZone?: boolean,
): L.DivIcon {
  const color = isSelected ? COLOR_SELECTED : isInZone ? COLOR_IN_ZONE : isApproaching ? COLOR_APPROACHING : COLOR_DEFAULT;
  const label = shortenTypeCode(aircraftType);
  const size = 40;
  const half = size / 2;

  // Outline-only triangle pointing up (no fill)
  const triSize = 18;
  const triHalf = triSize / 2;
  const triSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${triSize} ${triSize}" width="${triSize}" height="${triSize}">
    <polygon points="${triHalf},2 ${triSize - 2},${triSize - 2} 2,${triSize - 2}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

  // The outer div rotates by heading. The text inside is counter-rotated to stay upright.
  const html = `<div style="width:${size}px;height:${size}px;display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(${track}deg);">
    <div style="line-height:0;">${triSvg}</div>
    <div style="transform:rotate(-${track}deg);font-size:9px;font-weight:700;font-family:system-ui,sans-serif;color:${color};line-height:1;margin-top:1px;white-space:nowrap;">${label}</div>
  </div>`;

  return L.divIcon({
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
    className: '',
  });
}

function FitBounds() {
  const map = useMap();
  useMemo(() => {
    map.fitBounds([
      [52.2, 4.5],
      [52.45, 5.2],
    ]);
  }, [map]);
  return null;
}

function FlightMarker({
  flight,
  isApproaching,
  labelMode,
  isSelected,
  onSelect,
}: {
  flight: Flight;
  isApproaching: boolean;
  labelMode: boolean;
  isSelected: boolean;
  onSelect: (flightId: string) => void;
}) {
  const icon = useMemo(() => {
    if (labelMode) {
      return createLabelIcon(flight.track, flight.aircraftType, isApproaching, isSelected);
    }
    const highlightColor = isSelected ? COLOR_SELECTED : undefined;
    if (highlightColor) {
      const category = classifyAircraft(flight.aircraftType);
      const { svg, size } = aircraftSvg(category, highlightColor);
      const half = size / 2;
      return L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;transform:rotate(${flight.track}deg);line-height:0;">${svg}</div>`,
        iconSize: [size, size],
        iconAnchor: [half, half],
        className: '',
      });
    }
    return createFlightIcon(flight.track, isApproaching, flight.aircraftType);
  }, [flight.track, isApproaching, flight.aircraftType, labelMode, isSelected]);

  const eventHandlers = useMemo(
    () => ({
      click() {
        onSelect(flight.id);
      },
    }),
    [flight.id, onSelect],
  );

  return (
    <Marker position={[flight.lat, flight.lon]} icon={icon} eventHandlers={eventHandlers} />
  );
}

/**
 * Knots → degrees-per-second conversion factor.
 * 1 knot = 1.852 km/h; 1 degree latitude ≈ 111 320 m.
 * So deg/s = (speed_kts * 1.852 * 1000) / (111320 * 3600).
 */
const KNOTS_TO_DEG_PER_SEC = (1.852 * 1000) / (111_320 * 3600);

/** Interpolate a flight's lat/lon from its last-known state + elapsed time. */
function interpolatePosition(
  lat: number,
  lon: number,
  speed: number,
  track: number,
  elapsedSec: number,
): [number, number] {
  const speedDegPerSec = speed * KNOTS_TO_DEG_PER_SEC;
  const trackRad = (track * Math.PI) / 180;
  // track 0 = north, so lat uses cos(track) and lon uses sin(track)
  const newLat = lat + speedDegPerSec * Math.cos(trackRad) * elapsedSec;
  const newLon =
    lon +
    (speedDegPerSec * Math.sin(trackRad) * elapsedSec) /
      Math.cos((lat * Math.PI) / 180);
  return [newLat, newLon];
}

/**
 * Wrapper around FlightMarker that smoothly interpolates position when
 * animation is enabled. Uses Leaflet's setLatLng() directly via marker ref
 * for smooth 60fps updates without React re-renders.
 */
function AnimatedFlightMarker({
  flight,
  isApproaching,
  animate,
  labelMode,
  isSelected,
  onSelect,
  isInZone,
}: {
  flight: Flight;
  isApproaching: boolean;
  animate: boolean;
  labelMode: boolean;
  isSelected: boolean;
  onSelect: (flightId: string) => void;
  isInZone: boolean;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number>(0);
  // Track current animated position and last frame time for smooth delta-based movement
  const posRef = useRef<{ lat: number; lon: number }>({ lat: flight.lat, lon: flight.lon });
  const lastFrameRef = useRef<number>(performance.now());
  const flightRef = useRef(flight);

  // When flight data updates from SSE, snap to the new real position
  if (flightRef.current.lat !== flight.lat || flightRef.current.lon !== flight.lon) {
    posRef.current = { lat: flight.lat, lon: flight.lon };
  }
  flightRef.current = flight;

  // rAF loop: advance position by deltaTime * speed each frame
  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - lastFrameRef.current) / 1000; // seconds since last frame
    lastFrameRef.current = now;

    const f = flightRef.current;
    const speedDegPerSec = f.speed * KNOTS_TO_DEG_PER_SEC;
    const trackRad = (f.track * Math.PI) / 180;
    const pos = posRef.current;

    pos.lat += speedDegPerSec * Math.cos(trackRad) * dt;
    pos.lon += (speedDegPerSec * Math.sin(trackRad) * dt) / Math.cos((pos.lat * Math.PI) / 180);

    markerRef.current?.setLatLng([pos.lat, pos.lon]);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Start/stop animation loop
  const wasAnimating = useRef(false);
  if (animate && !wasAnimating.current) {
    wasAnimating.current = true;
    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  } else if (!animate && wasAnimating.current) {
    wasAnimating.current = false;
    cancelAnimationFrame(rafRef.current);
    posRef.current = { lat: flight.lat, lon: flight.lon };
    markerRef.current?.setLatLng([flight.lat, flight.lon]);
  }

  const displayLat = animate ? posRef.current.lat : flight.lat;
  const displayLon = animate ? posRef.current.lon : flight.lon;

  const icon = useMemo(() => {
    if (labelMode) {
      return createLabelIcon(flight.track, flight.aircraftType, isApproaching, isSelected, isInZone);
    }
    return createFlightIcon(flight.track, isApproaching, flight.aircraftType, isInZone);
  }, [flight.track, flight.aircraftType, isApproaching, isSelected, labelMode, isInZone]);

  const eventHandlers = useMemo(
    () => ({ click() { onSelect(flight.id); } }),
    [flight.id, onSelect],
  );

  return (
    <Marker
      ref={markerRef}
      position={[displayLat, displayLon]}
      icon={icon}
      eventHandlers={eventHandlers}
    />
  );
}

/** Handles click events to draw a notification zone rectangle (two-click). */
function DrawZoneHandler({
  drawing,
  firstCorner,
  onFirstClick,
  onSecondClick,
  onMapClick,
  onMouseMove,
}: {
  drawing: boolean;
  firstCorner: L.LatLng | null;
  onFirstClick: (latlng: L.LatLng) => void;
  onSecondClick: (latlng: L.LatLng) => void;
  onMapClick?: () => void;
  onMouseMove?: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (drawing) {
        if (!firstCorner) {
          onFirstClick(e.latlng);
        } else {
          onSecondClick(e.latlng);
        }
      } else {
        onMapClick?.();
      }
    },
    mousemove(e) {
      if (drawing && firstCorner) {
        onMouseMove?.(e.latlng);
      }
    },
  });
  return null;
}

/** Small circle marker to show where the first corner was placed. */
function FirstCornerMarker({ position }: { position: L.LatLng }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<div style="width:10px;height:10px;background:${COLOR_ZONE_BORDER};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        className: '',
      }),
    [],
  );
  return <Marker position={position} icon={icon} interactive={false} />;
}

/** Drag handle marker for resizing the notification zone. */
function DragHandle({ position, onDrag }: { position: [number, number]; onDrag: (latlng: L.LatLng) => void }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<div style="width:12px;height:12px;background:${COLOR_ZONE_BORDER};border:2px solid white;border-radius:2px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      }),
    []
  );

  const eventHandlers = useMemo(
    () => ({
      drag(e: L.LeafletEvent) {
        const marker = e.target as L.Marker;
        onDrag(marker.getLatLng());
      },
    }),
    [onDrag]
  );

  return <Marker position={position} icon={icon} draggable eventHandlers={eventHandlers} />;
}

/** Inline display for altitude with NumberFlow animation. */
function InlineAltitude({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-muted-foreground">Alt</span>
      <div className="flex items-baseline gap-1">
        <NumberFlow
          value={staggered}
          format={{ useGrouping: true }}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-sm font-semibold text-foreground"
        />
        <span className="text-[10px] text-muted-foreground">ft</span>
      </div>
    </div>
  );
}

/** Inline display for speed with NumberFlow animation. */
function InlineSpeed({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-muted-foreground">Speed</span>
      <div className="flex items-baseline gap-1">
        <NumberFlow
          value={staggered}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-sm font-semibold text-foreground"
        />
        <span className="text-[10px] text-muted-foreground">kts</span>
      </div>
    </div>
  );
}

/** Inline display for heading with NumberFlow animation. */
function InlineHeading({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-muted-foreground">Hdg</span>
      <NumberFlow
        value={staggered}
        willChange
        trend={0}
        style={{ fontVariantNumeric: 'tabular-nums' }}
        suffix="°"
        className="text-sm font-semibold text-foreground"
      />
    </div>
  );
}

/** Inline display for vertical speed using VsCell in non-table mode. */
function InlineVs({ value }: { value: number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-muted-foreground">V/S</span>
      <div className="text-sm font-semibold">
        <VsCell value={value} asTableCell={false} />
      </div>
    </div>
  );
}

/** Airport badge with flag + IATA code and city tooltip. */
function AirportBadge({ label, iata }: { label: string; iata: string }) {
  const info = getAirportInfo(iata);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {info ? (
        <span className="text-sm font-semibold text-foreground" title={info.city}>
          {countryCodeToFlag(info.countryCode)} {info.iata}
        </span>
      ) : (
        <span className="text-sm font-semibold text-foreground">{iata}</span>
      )}
    </div>
  );
}

/** Selected flight detail panel — two-column grid layout. */
function SelectedFlightPanel({
  flight,
  onClose,
}: {
  flight: Flight;
  onClose: () => void;
}) {
  return (
    <div className="border-t bg-muted/40 px-4 py-3 text-xs">
      {/* Header row: aircraft type + close button */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-base font-semibold">
          <AircraftTypeBadge typeCode={flight.aircraftType} />
        </div>
        <button
          onClick={onClose}
          className="rounded-full w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-bold"
          title="Deselect"
        >
          &times;
        </button>
      </div>
      {/* Two-column data grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {flight.origin && <AirportBadge label="From" iata={flight.origin} />}
        {flight.destination && <AirportBadge label="To" iata={flight.destination} />}
        {!flight.origin && !flight.destination && <div className="col-span-2" />}
        {flight.origin && !flight.destination && <div />}
        <InlineAltitude value={flight.alt} />
        <InlineSpeed value={flight.speed} />
        <InlineHeading value={flight.track} />
        <InlineVs value={flight.verticalRate} />
      </div>
    </div>
  );
}

const SCHIPHOL_LAT = 52.3105;
const SCHIPHOL_LON = 4.7683;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FlightMapInnerProps {
  airborneFlights: Flight[];
  approachingIds: Set<string>;
  weather: import('@/lib/api/weather').MetarData | null;
}

export default function FlightMapInner({ airborneFlights, approachingIds, weather }: FlightMapInnerProps) {
  const isDark = useIsDarkMode();
  const { zone, visible, setZone, clearZone, toggleVisible, isInZone } = useNotificationZone();
  // --- Animate toggle (persisted to localStorage) ---
  const ANIMATE_KEY = 'flightnotifier-animate';
  const [animateState, setAnimateState] = useState(false);
  const hasSyncedAnimate = useRef(false);

  const getAnimate = useCallback((): boolean => {
    if (!hasSyncedAnimate.current && typeof window !== 'undefined') {
      hasSyncedAnimate.current = true;
      try {
        const stored = localStorage.getItem(ANIMATE_KEY) === 'true';
        if (stored) setAnimateState(true);
        return stored;
      } catch { return false; }
    }
    return animateState;
  }, [animateState]);

  const setAnimate = useCallback((v: boolean) => {
    hasSyncedAnimate.current = true;
    setAnimateState(v);
    try { localStorage.setItem(ANIMATE_KEY, String(v)); } catch {}
  }, []);

  const animate = getAnimate();

  // --- Label mode toggle (persisted to localStorage) ---
  const LABEL_MODE_KEY = 'flightnotifier-label-mode';
  const [labelModeState, setLabelModeState] = useState(false);
  const hasSyncedLabelMode = useRef(false);

  const getLabelMode = useCallback((): boolean => {
    if (!hasSyncedLabelMode.current && typeof window !== 'undefined') {
      hasSyncedLabelMode.current = true;
      try {
        const stored = localStorage.getItem(LABEL_MODE_KEY) === 'true';
        if (stored) setLabelModeState(true);
        return stored;
      } catch { return false; }
    }
    return labelModeState;
  }, [labelModeState]);

  const setLabelMode = useCallback((v: boolean) => {
    hasSyncedLabelMode.current = true;
    setLabelModeState(v);
    try { localStorage.setItem(LABEL_MODE_KEY, String(v)); } catch {}
  }, []);

  const labelMode = getLabelMode();
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const firstCornerRef = useRef<L.LatLng | null>(null);
  const [firstCorner, setFirstCorner] = useState<L.LatLng | null>(null);
  const [mousePosition, setMousePosition] = useState<L.LatLng | null>(null);
  const [zoneEditing, setZoneEditing] = useState(false);
  const zoneClickedRef = useRef(false);

  const handleSelectFlight = useCallback((flightId: string) => {
    setSelectedFlightId((prev) => (prev === flightId ? null : flightId));
  }, []);

  const selectedFlight = useMemo(
    () => (selectedFlightId ? airborneFlights.find((f) => f.id === selectedFlightId) ?? null : null),
    [selectedFlightId, airborneFlights],
  );

  const handleStartDraw = useCallback(() => {
    setDrawing(true);
    firstCornerRef.current = null;
    setFirstCorner(null);
    setMousePosition(null);
  }, []);

  const handleFirstClick = useCallback((latlng: L.LatLng) => {
    firstCornerRef.current = latlng;
    setFirstCorner(latlng);
  }, []);

  const handleSecondClick = useCallback(
    (latlng: L.LatLng) => {
      const first = firstCornerRef.current;
      if (!first) return;

      const bounds: ZoneBounds = {
        south: Math.min(first.lat, latlng.lat),
        north: Math.max(first.lat, latlng.lat),
        west: Math.min(first.lng, latlng.lng),
        east: Math.max(first.lng, latlng.lng),
      };
      setZone(bounds);
      setDrawing(false);
      firstCornerRef.current = null;
      setFirstCorner(null);
      setMousePosition(null);
    },
    [setZone]
  );

  const handleReset = useCallback(() => {
    clearZone();
    setDrawing(false);
    firstCornerRef.current = null;
    setFirstCorner(null);
    setMousePosition(null);
  }, [clearZone]);

  const handleMouseMove = useCallback((latlng: L.LatLng) => {
    setMousePosition(latlng);
  }, []);

  const handleDragSW = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({
        ...zone,
        south: Math.min(latlng.lat, zone.north),
        west: Math.min(latlng.lng, zone.east),
      });
    },
    [zone, setZone]
  );

  const handleDragNE = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({
        ...zone,
        north: Math.max(latlng.lat, zone.south),
        east: Math.max(latlng.lng, zone.west),
      });
    },
    [zone, setZone]
  );

  const handleDragNW = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({
        ...zone,
        north: Math.max(latlng.lat, zone.south),
        west: Math.min(latlng.lng, zone.east),
      });
    },
    [zone, setZone]
  );

  const handleDragSE = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({
        ...zone,
        south: Math.min(latlng.lat, zone.north),
        east: Math.max(latlng.lng, zone.west),
      });
    },
    [zone, setZone]
  );

  const zoneBounds: L.LatLngBoundsExpression | null = zone
    ? [
        [zone.south, zone.west],
        [zone.north, zone.east],
      ]
    : null;

  const ghostBounds: L.LatLngBoundsExpression | null =
    drawing && firstCorner && mousePosition
      ? [
          [Math.min(firstCorner.lat, mousePosition.lat), Math.min(firstCorner.lng, mousePosition.lng)],
          [Math.max(firstCorner.lat, mousePosition.lat), Math.max(firstCorner.lng, mousePosition.lng)],
        ]
      : null;

  const selectedFlightDistance = useMemo(() => {
    if (!selectedFlight) return null;
    return Math.round(haversineKm(selectedFlight.lat, selectedFlight.lon, SCHIPHOL_LAT, SCHIPHOL_LON));
  }, [selectedFlight]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Radar-style HUD header */}
      <div className="flex items-center justify-between px-3 py-1.5 border border-b-0 rounded-t font-mono text-[11px] text-muted-foreground shrink-0">
        {/* Wind info — top left */}
        <div title="Wind direction / speed">
          {weather && weather.windSpeed != null ? (
            <span>
              <span className="font-semibold text-foreground">
                {weather.windDirection != null ? `${String(weather.windDirection).padStart(3, '0')}°` : 'VRB'}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold text-foreground">{weather.windSpeed}kt</span>
              {weather.windGust != null && weather.windGust > (weather.windSpeed ?? 0) && (
                <span className="text-amber-500 font-semibold"> G{weather.windGust}kt</span>
              )}
            </span>
          ) : (
            <span>WIND ---</span>
          )}
        </div>

        {/* Selected aircraft heading — center */}
        {selectedFlight && (
          <div className="border rounded px-2 py-0.5 font-semibold text-foreground">
            HDG {String(selectedFlight.track).padStart(3, '0')}°
          </div>
        )}

        {/* Distance from airport — top right */}
        {selectedFlight && selectedFlightDistance != null && (
          <div title="Distance to Schiphol">
            <span className="font-semibold text-foreground">{selectedFlightDistance}</span>
            <span className="ml-0.5">km</span>
          </div>
        )}
        {!selectedFlight && <div />}
      </div>

      <div className="relative flex-1 min-h-0">
      <MapContainer
        center={SCHIPHOL_POS}
        zoom={12}
        minZoom={9}
        maxZoom={16}
        maxBounds={[[52.0, 4.2], [52.6, 5.5]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          attribution={TILE_ATTRIBUTION}
          url={isDark ? TILE_DARK : TILE_LIGHT}
        />
        <FitBounds />

        <DrawZoneHandler
          drawing={drawing}
          firstCorner={firstCorner}
          onFirstClick={handleFirstClick}
          onSecondClick={handleSecondClick}
          onMouseMove={handleMouseMove}
          onMapClick={() => {
            // Don't dismiss editing if the click was on the zone rectangle itself
            if (zoneClickedRef.current) {
              zoneClickedRef.current = false;
              return;
            }
            setZoneEditing(false);
          }}
        />

        {/* Approach detection cones */}
        <Polygon
          positions={APPROACH_CONE_27}
          pathOptions={{
            color: COLOR_CONE,
            fillColor: COLOR_CONE,
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '6 3',
          }}
        />

        {/* Notification zone rectangle */}
        {zone && visible && zoneBounds && (
          <>
            {/* Invisible fat-border hit target for easier clicking */}
            <Rectangle
              bounds={zoneBounds}
              pathOptions={{
                color: 'transparent',
                fillColor: COLOR_ZONE_BORDER,
                fillOpacity: 0.15,
                weight: 18,
                opacity: 0,
                className: 'cursor-pointer',
              }}
              eventHandlers={{
                click: () => {
                  // Flag that zone was clicked so the map click handler won't dismiss editing
                  zoneClickedRef.current = true;
                  setZoneEditing((v) => !v);
                },
                mouseover: (e: L.LeafletMouseEvent) => {
                  e.target.getElement()?.style.setProperty('cursor', 'pointer');
                },
              }}
            />
            {/* Visible zone border */}
            <Rectangle
              bounds={zoneBounds}
              pathOptions={{
                color: COLOR_ZONE_BORDER,
                fillColor: COLOR_ZONE_BORDER,
                fillOpacity: 0,
                weight: 3,
                dashArray: '8 4',
                interactive: false,
              }}
            />
            {/* Drag handles at corners — only visible when zone is being edited */}
            {zoneEditing && (
              <>
                <DragHandle position={[zone.south, zone.west]} onDrag={handleDragSW} />
                <DragHandle position={[zone.north, zone.east]} onDrag={handleDragNE} />
                <DragHandle position={[zone.north, zone.west]} onDrag={handleDragNW} />
                <DragHandle position={[zone.south, zone.east]} onDrag={handleDragSE} />
              </>
            )}
          </>
        )}

        {/* Ghost rectangle preview while drawing */}
        {ghostBounds && (
          <Rectangle
            bounds={ghostBounds}
            pathOptions={{
              color: COLOR_ZONE_BORDER,
              fillColor: COLOR_ZONE_BORDER,
              fillOpacity: 0.05,
              weight: 2,
              dashArray: '4 4',
            }}
          />
        )}

        {/* First corner marker while drawing */}
        {drawing && firstCorner && <FirstCornerMarker position={firstCorner} />}

        {/* EHAM runway polygons */}
        {EHAM_RUNWAY_POLYGONS.map((rwy) => (
          <Polygon
            key={`${rwy.leIdent}/${rwy.heIdent}`}
            positions={rwy.corners}
            pathOptions={{
              color: isDark ? COLOR_RUNWAY_STROKE_DARK : COLOR_RUNWAY_STROKE_LIGHT,
              fillColor: isDark ? COLOR_RUNWAY_FILL_DARK : COLOR_RUNWAY_FILL_LIGHT,
              fillOpacity: 0.7,
              weight: 1,
            }}
          />
        ))}
        {EHAM_RUNWAYS.map((rwy) => (
          <React.Fragment key={`lbl-${rwy.leIdent}`}>
            <Marker position={rwy.le} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
              <Tooltip permanent direction="center" className="runway-label">{rwy.leIdent}</Tooltip>
            </Marker>
            <Marker position={rwy.he} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
              <Tooltip permanent direction="center" className="runway-label">{rwy.heIdent}</Tooltip>
            </Marker>
          </React.Fragment>
        ))}

        {airborneFlights.map((flight) => (
          <AnimatedFlightMarker
            key={flight.id}
            flight={flight}
            isApproaching={approachingIds.has(flight.id)}
            animate={animate}
            labelMode={labelMode}
            isSelected={selectedFlightId === flight.id}
            onSelect={handleSelectFlight}
            isInZone={!!zone && isInZone(flight.lat, flight.lon)}
          />
        ))}
      </MapContainer>
      </div>
      {/* Selected flight detail panel — always reserves space below map */}
      <div className="min-h-[80px] shrink-0">
        {selectedFlight ? (
          <SelectedFlightPanel
            flight={selectedFlight}
            onClose={() => setSelectedFlightId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-[80px] border-t text-xs text-muted-foreground/50 font-mono select-none">
            Click an aircraft to see details
          </div>
        )}
      </div>
      {/* Controls bar — bottom */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t text-xs">
        <button
          onClick={() => setAnimate(!animate)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors select-none ${
            animate
              ? 'bg-blue-600 text-white'
              : 'border border-zinc-300 dark:border-zinc-600 text-muted-foreground hover:text-foreground'
          }`}
        >
          Animate
        </button>
        <button
          onClick={() => setLabelMode(!labelMode)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors select-none ${
            labelMode
              ? 'bg-blue-600 text-white'
              : 'border border-zinc-300 dark:border-zinc-600 text-muted-foreground hover:text-foreground'
          }`}
        >
          Labels
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button
          onClick={drawing ? handleReset : handleStartDraw}
          className={`rounded px-2 py-1 font-medium transition-colors ${
            drawing
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {drawing ? (firstCorner ? 'Click 2nd corner...' : 'Click 1st corner...') : 'Draw Zone'}
        </button>
        {zone && (
          <>
            <button
              onClick={toggleVisible}
              className="rounded px-2 py-1 font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {visible ? 'Hide Zone' : 'Show Zone'}
            </button>
            <button
              onClick={handleReset}
              className="rounded px-2 py-1 font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Reset Zone
            </button>
          </>
        )}
      </div>
    </div>
  );
}
