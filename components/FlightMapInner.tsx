'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Rectangle, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Flight } from '@/lib/types';
import { useNotificationZone, type ZoneBounds } from '@/lib/notificationZoneContext';
import { APPROACH_CONE_27 } from '@/lib/approachCone';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

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

/** Pre-compute all runway polygons (static data, never changes). */
const EHAM_RUNWAY_POLYGONS = EHAM_RUNWAYS.map((rwy) => ({
  ...rwy,
  corners: runwayPolygon(rwy.le, rwy.he, rwy.widthFt),
}));

function createFlightIcon(track: number, isApproaching: boolean): L.DivIcon {
  const color = isApproaching ? '#16a34a' : '#2563eb';
  return L.divIcon({
    html: `<div style="font-size:18px;color:${color};transform:rotate(${track - 90}deg);text-align:center;line-height:1;">&#9992;</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

function FlightMarker({ flight, isApproaching }: { flight: Flight; isApproaching: boolean }) {
  const icon = useMemo(() => createFlightIcon(flight.track, isApproaching), [flight.track, isApproaching]);

  return (
    <Marker position={[flight.lat, flight.lon]} icon={icon}>
      <Popup>
        <div className="text-xs">
          <div className="font-bold">{flight.callsign || flight.id}</div>
          {flight.aircraftType && (
            <div className="flex items-center gap-1">
              Type: {flight.manufacturer && <span>{flight.manufacturer}</span>}{' '}
              <AircraftTypeBadge typeCode={flight.aircraftType} />
            </div>
          )}
          {flight.registration && <div>Reg: {flight.registration}</div>}
          {flight.owner && <div>Owner: {flight.owner}</div>}
          {flight.origin &&
            (() => {
              const info = getAirportInfo(flight.origin);
              return info ? (
                <div>
                  From: {countryCodeToFlag(info.countryCode)} {info.city}
                </div>
              ) : (
                <div>From: {flight.origin}</div>
              );
            })()}
          {flight.destination &&
            (() => {
              const info = getAirportInfo(flight.destination);
              return info ? (
                <div>
                  To: {countryCodeToFlag(info.countryCode)} {info.city}
                </div>
              ) : (
                <div>To: {flight.destination}</div>
              );
            })()}
          <div>Alt: {flight.alt.toLocaleString()} ft</div>
          <div>Speed: {flight.speed} kts</div>
          <div>Heading: {flight.track}&deg;</div>
          <div>V/S: {flight.verticalRate} ft/min</div>
        </div>
      </Popup>
    </Marker>
  );
}

/** Handles click events to draw a notification zone rectangle (two-click). */
function DrawZoneHandler({
  drawing,
  firstCorner,
  onFirstClick,
  onSecondClick,
}: {
  drawing: boolean;
  firstCorner: L.LatLng | null;
  onFirstClick: (latlng: L.LatLng) => void;
  onSecondClick: (latlng: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (!drawing) return;
      if (!firstCorner) {
        onFirstClick(e.latlng);
      } else {
        onSecondClick(e.latlng);
      }
    },
  });
  return null;
}

/** Drag handle marker for resizing the notification zone. */
function DragHandle({ position, onDrag }: { position: [number, number]; onDrag: (latlng: L.LatLng) => void }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: '<div style="width:12px;height:12px;background:#3b82f6;border:2px solid white;border-radius:2px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
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

interface FlightMapInnerProps {
  airborneFlights: Flight[];
  approachingIds: Set<string>;
}

export default function FlightMapInner({ airborneFlights, approachingIds }: FlightMapInnerProps) {
  const { zone, visible, setZone, clearZone, toggleVisible } = useNotificationZone();
  const [drawing, setDrawing] = useState(false);
  const firstCornerRef = useRef<L.LatLng | null>(null);
  const [firstCorner, setFirstCorner] = useState<L.LatLng | null>(null);

  const handleStartDraw = useCallback(() => {
    setDrawing(true);
    firstCornerRef.current = null;
    setFirstCorner(null);
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
    },
    [setZone]
  );

  const handleReset = useCallback(() => {
    clearZone();
    setDrawing(false);
    firstCornerRef.current = null;
    setFirstCorner(null);
  }, [clearZone]);

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

  return (
    <div className="relative h-full w-full">
      {/* Map controls overlay */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1.5">
        <button
          onClick={drawing ? handleReset : handleStartDraw}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-colors ${
            drawing
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'bg-white/90 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-600'
          }`}
        >
          {drawing ? (firstCorner ? 'Click 2nd corner...' : 'Click 1st corner...') : 'Draw Zone'}
        </button>
        {zone && (
          <>
            <button
              onClick={toggleVisible}
              className="rounded-lg bg-white/90 dark:bg-zinc-800/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm border border-zinc-200 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
            >
              {visible ? 'Hide Zone' : 'Show Zone'}
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg bg-white/90 dark:bg-zinc-800/90 px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
            >
              Reset Zone
            </button>
          </>
        )}
      </div>

      <MapContainer center={SCHIPHOL_POS} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds />

        <DrawZoneHandler
          drawing={drawing}
          firstCorner={firstCorner}
          onFirstClick={handleFirstClick}
          onSecondClick={handleSecondClick}
        />

        {/* Approach detection cones */}
        <Polygon
          positions={APPROACH_CONE_27}
          pathOptions={{
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.08,
            weight: 2,
            dashArray: '6 3',
          }}
        />

        {/* Notification zone rectangle */}
        {zone && visible && zoneBounds && (
          <>
            <Rectangle
              bounds={zoneBounds}
              pathOptions={{
                color: '#3b82f6',
                fillColor: '#3b82f6',
                fillOpacity: 0.1,
                weight: 2,
                dashArray: '8 4',
              }}
            />
            {/* Drag handles at corners */}
            <DragHandle position={[zone.south, zone.west]} onDrag={handleDragSW} />
            <DragHandle position={[zone.north, zone.east]} onDrag={handleDragNE} />
            <DragHandle position={[zone.north, zone.west]} onDrag={handleDragNW} />
            <DragHandle position={[zone.south, zone.east]} onDrag={handleDragSE} />
          </>
        )}

        {/* EHAM runway polygons */}
        {EHAM_RUNWAY_POLYGONS.map((rwy) => (
          <Polygon
            key={`${rwy.leIdent}/${rwy.heIdent}`}
            positions={rwy.corners}
            pathOptions={{
              color: '#555',
              fillColor: '#333',
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Tooltip permanent direction="center" className="runway-label">
              {rwy.leIdent}/{rwy.heIdent}
            </Tooltip>
          </Polygon>
        ))}

        {airborneFlights.map((flight) => (
          <FlightMarker key={flight.id} flight={flight} isApproaching={approachingIds.has(flight.id)} />
        ))}
      </MapContainer>
    </div>
  );
}
