'use client';

import { useMemo } from 'react';
import { Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { COLOR_ZONE_BORDER } from './mapConstants';

export function DrawZoneHandler({
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

export function FirstCornerMarker({ position }: { position: L.LatLng }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: `<div style="width:10px;height:10px;background:${COLOR_ZONE_BORDER};border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
        className: '',
      }),
    []
  );
  return <Marker position={position} icon={icon} interactive={false} />;
}

export function DragHandle({ position, onDrag }: { position: [number, number]; onDrag: (latlng: L.LatLng) => void }) {
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
