'use client';

import { useMemo } from 'react';
import { MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { HistoricalFlightPath } from '@/lib/types';

const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];
const APPROACH_CONE_27: [number, number][] = [
  [52.322, 4.78],
  [52.34, 5.1],
  [52.286, 5.1],
  [52.304, 4.78],
];

const schipholIcon = L.divIcon({
  html: '<div style="font-size:20px;text-align:center;">&#x2708;&#xFE0F;</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: '',
});

function FitToHistory({ path }: { path: [number, number][] }) {
  const map = useMap();

  useMemo(() => {
    if (path.length > 1) {
      map.fitBounds(path, { padding: [20, 20] });
      return;
    }

    map.fitBounds(
      [
        [52.2, 4.5],
        [52.45, 5.15],
      ],
      { padding: [20, 20] },
    );
  }, [map, path]);

  return null;
}

interface HistoricApproachMapInnerProps {
  history: HistoricalFlightPath;
}

export default function HistoricApproachMapInner({ history }: HistoricApproachMapInnerProps) {
  const positions = useMemo<[number, number][]>(
    () => history.path.map((point) => [point.lat, point.lon]),
    [history.path],
  );

  return (
    <div className="h-[280px] w-full overflow-hidden rounded-xl border">
      <MapContainer
        center={SCHIPHOL_POS}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToHistory path={positions} />
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
        {positions.length > 1 && (
          <Polyline
            positions={positions}
            pathOptions={{
              color: history.interceptedCone ? '#2563eb' : '#dc2626',
              weight: 3,
            }}
          />
        )}
        <Marker position={SCHIPHOL_POS} icon={schipholIcon}>
          <Popup>Amsterdam Schiphol</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
