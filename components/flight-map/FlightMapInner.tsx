'use client';

import React, { useMemo, useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { MapContainer, TileLayer, Polygon, Rectangle, Tooltip, Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Flight } from '@/lib/types';
import { useNotificationZone, type ZoneBounds } from '@/lib/notificationZoneContext';
import { useAnimate } from '@/lib/animateContext';
import { buildConePolygon } from '@/lib/buildConePolygon';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';
import { useSelectedFlight } from '@/lib/selectedFlightContext';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import { coneMatchesSelection, runwayMatchesSelection } from '@/lib/runwaySelection';
import { useRunways, type Runway } from '@/hooks/useRunways';
import {
  TILE_LIGHT,
  TILE_DARK,
  TILE_ATTRIBUTION,
  COLOR_CONE,
  COLOR_ZONE_BORDER,
  COLOR_RUNWAY_FILL_LIGHT,
  COLOR_RUNWAY_FILL_DARK,
  COLOR_RUNWAY_STROKE_LIGHT,
  COLOR_RUNWAY_STROKE_DARK,
  RUNWAY_WIDTH_SCALE,
} from './mapConstants';
import { haversineKm, runwayPolygon } from './mapGeometry';
import { SelectedFlightPanel } from './SelectedFlightPanel';
import { DrawZoneHandler, FirstCornerMarker, DragHandle } from './DrawZoneHandler';
import { AnimatedFlightMarker } from './AnimatedFlightMarker';

// ---------------------------------------------------------------------------
// Dark mode subscription
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

const CONE_HALF_ANGLE_DEG = 6;
const CONE_LENGTH_M = 28_000;

const noZone = () => false;

interface RunwayPolygonData {
  key: string;
  corners: [number, number][];
  le: [number, number];
  he: [number, number];
  leIdent: string;
  heIdent: string;
}

interface ConeData {
  key: string;
  runwayKey: string;
  polygon: [number, number][];
  leIdent: string;
  heIdent: string;
}

function buildRunwayPolygons(runways: Runway[]): RunwayPolygonData[] {
  return runways.flatMap((rwy) => {
    if (
      rwy.leLatitudeDeg == null ||
      rwy.leLongitudeDeg == null ||
      rwy.heLatitudeDeg == null ||
      rwy.heLongitudeDeg == null ||
      rwy.widthFt == null
    ) {
      return [];
    }

    const le: [number, number] = [rwy.leLatitudeDeg, rwy.leLongitudeDeg];
    const he: [number, number] = [rwy.heLatitudeDeg, rwy.heLongitudeDeg];

    return [{
      key: `strip-${rwy.id}`,
      corners: runwayPolygon(le, he, rwy.widthFt * RUNWAY_WIDTH_SCALE),
      le,
      he,
      leIdent: rwy.leIdent ?? '',
      heIdent: rwy.heIdent ?? '',
    }];
  });
}

function buildRunwayCones(runways: Runway[]): ConeData[] {
  const cones: ConeData[] = [];

  for (const rwy of runways) {
    const runwayKey = `strip-${rwy.id}`;
    const leIdent = rwy.leIdent ?? '';
    const heIdent = rwy.heIdent ?? '';

    if (rwy.leLatitudeDeg != null && rwy.leLongitudeDeg != null && rwy.leHeadingDegT != null) {
      cones.push({
        key: `${rwy.id}-le-${leIdent}`,
        runwayKey,
        leIdent,
        heIdent,
        polygon: buildConePolygon({
          threshold: [rwy.leLatitudeDeg, rwy.leLongitudeDeg],
          approachBearing: (rwy.leHeadingDegT + 180) % 360,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }

    if (rwy.heLatitudeDeg != null && rwy.heLongitudeDeg != null && rwy.heHeadingDegT != null) {
      cones.push({
        key: `${rwy.id}-he-${heIdent}`,
        runwayKey,
        leIdent,
        heIdent,
        polygon: buildConePolygon({
          threshold: [rwy.heLatitudeDeg, rwy.heLongitudeDeg],
          approachBearing: (rwy.heHeadingDegT + 180) % 360,
          halfAngleDeg: CONE_HALF_ANGLE_DEG,
          lengthM: CONE_LENGTH_M,
        }),
      });
    }
  }

  return cones;
}

function buildAirportBounds(
  airport: { latitude: number; longitude: number },
  runways: RunwayPolygonData[],
  cones: ConeData[],
): L.LatLngBoundsExpression {
  const points = [...runways.flatMap((runway) => runway.corners), ...cones.flatMap((cone) => cone.polygon)];
  if (points.length === 0) {
    const lat = airport.latitude;
    const lon = airport.longitude;
    return [
      [lat - 0.12, lon - 0.18],
      [lat + 0.12, lon + 0.18],
    ];
  }

  const lats = points.map((point) => point[0]);
  const lons = points.map((point) => point[1]);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface FlightMapInnerProps {
  airborneFlights: Flight[];
  approachingIds: Set<string>;
  weather: import('@/lib/api/weather').MetarData | null;
}

export default function FlightMapInner({ airborneFlights, approachingIds, weather }: FlightMapInnerProps) {
  const isDark = useIsDarkMode();
  const { zone, visible, setZone, clearZone, toggleVisible, isInZone } = useNotificationZone();
  const { animateEnabled: animate } = useAnimate();
  const focusedAirport = useSelectedAirportsStore((state) => state.selectedAirports[0] ?? DEFAULT_AIRPORT);
  const selectedRunways = useSelectedAirportsStore((state) => state.selectedRunways);
  const { data: runways = [] } = useRunways(focusedAirport.ident);

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
      } catch {
        return false;
      }
    }
    return labelModeState;
  }, [labelModeState]);

  const setLabelMode = useCallback((v: boolean) => {
    hasSyncedLabelMode.current = true;
    setLabelModeState(v);
    try {
      localStorage.setItem(LABEL_MODE_KEY, String(v));
    } catch {}
  }, []);

  const labelMode = getLabelMode();

  // --- Show area toggle (persisted to localStorage) ---
  const AREA_KEY = 'flightnotifier-show-area';
  const [showAreaState, setShowAreaState] = useState(false);
  const hasSyncedArea = useRef(false);

  const getShowArea = useCallback((): boolean => {
    if (!hasSyncedArea.current && typeof window !== 'undefined') {
      hasSyncedArea.current = true;
      try {
        const stored = localStorage.getItem(AREA_KEY) === 'true';
        if (stored) setShowAreaState(true);
        return stored;
      } catch {
        return false;
      }
    }
    return showAreaState;
  }, [showAreaState]);

  const setShowArea = useCallback((v: boolean) => {
    hasSyncedArea.current = true;
    setShowAreaState(v);
    try {
      localStorage.setItem(AREA_KEY, String(v));
    } catch {}
  }, []);

  const showArea = getShowArea();

  const { selectedFlightId, setSelectedFlightId } = useSelectedFlight();
  const [drawing, setDrawing] = useState(false);
  const firstCornerRef = useRef<L.LatLng | null>(null);
  const [firstCorner, setFirstCorner] = useState<L.LatLng | null>(null);
  const [mousePosition, setMousePosition] = useState<L.LatLng | null>(null);
  const [zoneEditing, setZoneEditing] = useState(false);
  const zoneClickedRef = useRef(false);

  const handleSelectFlight = useCallback(
    (flightId: string) => {
      setSelectedFlightId(selectedFlightId === flightId ? null : flightId);
    },
    [selectedFlightId, setSelectedFlightId]
  );

  const selectedFlight = useMemo(
    () => (selectedFlightId ? (airborneFlights.find((f) => f.id === selectedFlightId) ?? null) : null),
    [selectedFlightId, airborneFlights]
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
      setZone({ ...zone, south: Math.min(latlng.lat, zone.north), west: Math.min(latlng.lng, zone.east) });
    },
    [zone, setZone]
  );

  const handleDragNE = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({ ...zone, north: Math.max(latlng.lat, zone.south), east: Math.max(latlng.lng, zone.west) });
    },
    [zone, setZone]
  );

  const handleDragNW = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({ ...zone, north: Math.max(latlng.lat, zone.south), west: Math.min(latlng.lng, zone.east) });
    },
    [zone, setZone]
  );

  const handleDragSE = useCallback(
    (latlng: L.LatLng) => {
      if (!zone) return;
      setZone({ ...zone, south: Math.min(latlng.lat, zone.north), east: Math.max(latlng.lng, zone.west) });
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
    return Math.round(haversineKm(selectedFlight.lat, selectedFlight.lon, focusedAirport.latitude, focusedAirport.longitude));
  }, [focusedAirport.latitude, focusedAirport.longitude, selectedFlight]);

  const selectedRunwaysForAirport = useMemo(
    () => selectedRunways.filter((runway) => runway.airportIdent === focusedAirport.ident),
    [focusedAirport.ident, selectedRunways],
  );
  const hasRunwayFocus = selectedRunwaysForAirport.length > 0;
  const runwayPolygons = useMemo(() => buildRunwayPolygons(runways), [runways]);
  const runwayCones = useMemo(() => buildRunwayCones(runways), [runways]);
  const visibleRunwayPolygons = useMemo(
    () =>
      hasRunwayFocus
        ? runwayPolygons.filter((runway) => runwayMatchesSelection(runway, selectedRunwaysForAirport))
        : runwayPolygons,
    [hasRunwayFocus, runwayPolygons, selectedRunwaysForAirport],
  );
  const visibleRunwayCones = useMemo(
    () =>
      hasRunwayFocus
        ? runwayCones.filter((cone) => coneMatchesSelection(cone, selectedRunwaysForAirport))
        : runwayCones,
    [hasRunwayFocus, runwayCones, selectedRunwaysForAirport],
  );
  const airportBounds = useMemo(
    () => buildAirportBounds(focusedAirport, visibleRunwayPolygons, visibleRunwayCones),
    [focusedAirport, visibleRunwayCones, visibleRunwayPolygons],
  );
  const showAreaForAirport = showArea && focusedAirport.ident === 'EHAM';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Radar-style HUD header */}
      <div className="grid grid-cols-3 items-center px-3 py-1.5 border-b font-mono text-[11px] text-muted-foreground shrink-0">
        <div className="justify-self-start" title="Wind direction / speed">
          {weather && weather.windSpeed != null ? (
            <span>
              <span className="font-semibold text-foreground">
                {weather.windDirection != null ? `${String(weather.windDirection).padStart(3, '0')}\u00B0` : 'VRB'}
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

        <div
          className={`justify-self-center border rounded px-2 py-0.5 font-semibold text-foreground ${
            selectedFlight ? 'visible' : 'invisible'
          }`.trim()}
        >
          {selectedFlight ? (
            <>
              HDG {String(selectedFlight.track).padStart(3, '0')}{'\u00B0'}
            </>
          ) : (
            <>
              HDG 000{'\u00B0'}
            </>
          )}
        </div>

        <div
          className={`justify-self-end ${selectedFlight && selectedFlightDistance != null ? 'visible' : 'invisible'}`.trim()}
          title={`Distance to ${focusedAirport.name}`}
        >
          {selectedFlightDistance != null ? (
            <>
              <span className="font-semibold text-foreground">{selectedFlightDistance}</span>
              <span className="ml-0.5">km</span>
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">000</span>
              <span className="ml-0.5">km</span>
            </>
          )}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <MapContainer
          key={focusedAirport.ident}
          bounds={airportBounds}
          boundsOptions={{ padding: [10, 10] }}
          minZoom={3}
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
          {showAreaForAirport && (
            <Rectangle
              bounds={[
                [52.13, 4.46],
                [52.52, 5.24],
              ]}
              pathOptions={{
                color: '#9ca3af',
                weight: 1.5,
                dashArray: '6 4',
                fillColor: '#9ca3af',
                fillOpacity: 0.03,
                interactive: false,
              }}
            />
          )}

          <DrawZoneHandler
            drawing={drawing}
            firstCorner={firstCorner}
            onFirstClick={handleFirstClick}
            onSecondClick={handleSecondClick}
            onMouseMove={handleMouseMove}
            onMapClick={() => {
              if (zoneClickedRef.current) {
                zoneClickedRef.current = false;
                return;
              }
              setZoneEditing(false);
            }}
          />

          {visibleRunwayCones.map((cone) => (
            <Polygon
              key={cone.key}
              positions={cone.polygon}
              pathOptions={{
                color: COLOR_CONE,
                fillColor: COLOR_CONE,
                fillOpacity: 0.08,
                weight: 2,
                dashArray: '6 3',
              }}
            />
          ))}

          {zone && visible && zoneBounds && (
            <>
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
                    zoneClickedRef.current = true;
                    setZoneEditing((v) => !v);
                  },
                  mouseover: (e: L.LeafletMouseEvent) => {
                    e.target.getElement()?.style.setProperty('cursor', 'pointer');
                  },
                }}
              />
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

          {drawing && firstCorner && <FirstCornerMarker position={firstCorner} />}

          {visibleRunwayPolygons.map((rwy) => {
            const isSelectedRunway = hasRunwayFocus && runwayMatchesSelection(rwy, selectedRunwaysForAirport);
            return (
            <Polygon
              key={`${rwy.leIdent}/${rwy.heIdent}`}
              positions={rwy.corners}
              pathOptions={{
                color: isSelectedRunway ? '#f97316' : isDark ? COLOR_RUNWAY_STROKE_DARK : COLOR_RUNWAY_STROKE_LIGHT,
                fillColor: isSelectedRunway ? '#f59e0b' : isDark ? COLOR_RUNWAY_FILL_DARK : COLOR_RUNWAY_FILL_LIGHT,
                fillOpacity: 0.7,
                weight: isSelectedRunway ? 2 : 1,
                dashArray: isSelectedRunway ? '10 6' : undefined,
              }}
            />
            );
          })}
          {visibleRunwayPolygons.map((rwy) => (
            <React.Fragment key={`lbl-${rwy.leIdent}`}>
              <Marker position={rwy.le} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
                <Tooltip permanent direction="center" className="runway-label">
                  {rwy.leIdent}
                </Tooltip>
              </Marker>
              <Marker position={rwy.he} icon={L.divIcon({ html: '', iconSize: [0, 0], className: '' })}>
                <Tooltip permanent direction="center" className="runway-label">
                  {rwy.heIdent}
                </Tooltip>
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
              checkInZone={zone ? isInZone : noZone}
            />
          ))}
        </MapContainer>
      </div>

      {/* Controls bar */}
      <div className="border-t px-3 py-2 text-xs space-y-1.5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLabelMode(!labelMode)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors select-none border ${
              labelMode
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-zinc-300 dark:border-zinc-600 text-muted-foreground hover:text-foreground'
            }`}
          >
            Labels
          </button>
          <button
            onClick={() => setShowArea(!showArea)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors select-none border ${
              showArea
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-zinc-300 dark:border-zinc-600 text-muted-foreground hover:text-foreground'
            }`}
          >
            Area
          </button>
          <button
            onClick={toggleVisible}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors select-none border ${
              zone && visible
                ? 'bg-blue-600 text-white border-blue-600'
                : 'border-zinc-300 dark:border-zinc-600 text-muted-foreground hover:text-foreground'
            }`}
          >
            Zone
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={drawing ? handleReset : handleStartDraw}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors select-none ${
              drawing ? 'bg-amber-500 text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {drawing ? (firstCorner ? 'Click 2nd corner...' : 'Click 1st corner...') : 'Draw Zone'}
          </button>
          {zone && (
            <button
              onClick={handleReset}
              className="flex-1 rounded-md py-1 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors select-none"
            >
              Reset Zone
            </button>
          )}
        </div>
      </div>

      {/* Selected flight detail panel */}
      <div className="h-[312px] shrink-0 border-t">
        <div className="h-full overflow-hidden min-h-0">
          {selectedFlight ? (
            <SelectedFlightPanel flight={selectedFlight} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50 font-mono select-none">
              Click an aircraft to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
