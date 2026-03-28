'use client';

import { useMemo, useCallback, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Flight } from '@/lib/types';
import { useNotificationZone, type ZoneBounds } from '@/lib/notificationZoneContext';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];

const APPROACH_CONE_27: [number, number][] = [
  [52.322, 4.78],
  [52.34, 5.1],
  [52.286, 5.1],
  [52.304, 4.78],
];

const APPROACH_CONE_09: [number, number][] = [
  [52.322, 4.835],
  [52.34, 4.5],
  [52.286, 4.5],
  [52.304, 4.835],
];

const schipholIcon = L.divIcon({
  html: '<div style="font-size:20px;text-align:center;">&#x2708;&#xFE0F;</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

function createFlightIcon(track: number, isApproaching: boolean): L.DivIcon {
  const color = isApproaching ? '#16a34a' : '#2563eb';
  return L.divIcon({
    html: `<div style="font-size:18px;color:${color};transform:rotate(${track}deg);text-align:center;line-height:1;">&#9992;</div>`,
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
  const icon = useMemo(
    () => createFlightIcon(flight.track, isApproaching),
    [flight.track, isApproaching],
  );

  return (
    <Marker position={[flight.lat, flight.lon]} icon={icon}>
      <Popup>
        <div className="text-xs">
          <div className="font-bold">{flight.callsign || flight.id}</div>
          {flight.aircraftType && <div className="flex items-center gap-1">Type: {flight.manufacturer && <span>{flight.manufacturer}</span>} <AircraftTypeBadge typeCode={flight.aircraftType} /></div>}
          {flight.registration && <div>Reg: {flight.registration}</div>}
          {flight.owner && <div>Owner: {flight.owner}</div>}
          {flight.origin && (() => {
            const info = getAirportInfo(flight.origin);
            return info
              ? <div>From: {countryCodeToFlag(info.countryCode)} {info.city}</div>
              : <div>From: {flight.origin}</div>;
          })()}
          {flight.destination && (() => {
            const info = getAirportInfo(flight.destination);
            return info
              ? <div>To: {countryCodeToFlag(info.countryCode)} {info.city}</div>
              : <div>To: {flight.destination}</div>;
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
function DragHandle({
  position,
  onDrag,
}: {
  position: [number, number];
  onDrag: (latlng: L.LatLng) => void;
}) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: '<div style="width:12px;height:12px;background:#3b82f6;border:2px solid white;border-radius:2px;cursor:grab;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: '',
      }),
    [],
  );

  const eventHandlers = useMemo(
    () => ({
      drag(e: L.LeafletEvent) {
        const marker = e.target as L.Marker;
        onDrag(marker.getLatLng());
      },
    }),
    [onDrag],
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
    [setZone],
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
    [zone, setZone],
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
    [zone, setZone],
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
    [zone, setZone],
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
    [zone, setZone],
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
          {drawing
            ? firstCorner
              ? 'Click 2nd corner...'
              : 'Click 1st corner...'
            : 'Draw Zone'}
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

      <MapContainer
        center={SCHIPHOL_POS}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
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
        <Polygon
          positions={APPROACH_CONE_09}
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

        <Marker position={SCHIPHOL_POS} icon={schipholIcon}>
          <Popup>
            <strong>Schiphol Airport (AMS)</strong>
            <br />
            Buitenveldertbaan
          </Popup>
        </Marker>

        {airborneFlights.map((flight) => (
          <FlightMarker
            key={flight.id}
            flight={flight}
            isApproaching={approachingIds.has(flight.id)}
          />
        ))}
      </MapContainer>
    </div>
  );
}
