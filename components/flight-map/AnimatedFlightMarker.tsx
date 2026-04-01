'use client';

import { useMemo, useCallback, useRef } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
import type { Flight } from '@/lib/types';
import { KNOTS_TO_DEG_PER_SEC } from './mapGeometry';
import { classifyAircraft, aircraftSvg, createFlightIcon, createLabelIcon } from './aircraftIcons';
import { COLOR_SELECTED } from './mapConstants';

export function FlightMarker({
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
    return createFlightIcon(flight.track, isApproaching, flight.aircraftType, false, isSelected);
  }, [flight.track, isApproaching, flight.aircraftType, labelMode, isSelected]);

  const eventHandlers = useMemo(
    () => ({
      click() {
        onSelect(flight.id);
      },
    }),
    [flight.id, onSelect]
  );

  return <Marker position={[flight.lat, flight.lon]} icon={icon} eventHandlers={eventHandlers} />;
}

export function AnimatedFlightMarker({
  flight,
  isApproaching,
  animate,
  labelMode,
  isSelected,
  onSelect,
  isInZone,
  checkInZone,
}: {
  flight: Flight;
  isApproaching: boolean;
  animate: boolean;
  labelMode: boolean;
  isSelected: boolean;
  onSelect: (flightId: string) => void;
  isInZone: boolean;
  checkInZone: (lat: number, lon: number) => boolean;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef<{ lat: number; lon: number }>({ lat: flight.lat, lon: flight.lon });
  const lastFrameRef = useRef<number>(performance.now());
  const flightRef = useRef(flight);
  const inZoneRef = useRef(isInZone);
  const iconRef = useRef<L.DivIcon | null>(null);

  if (flightRef.current.lat !== flight.lat || flightRef.current.lon !== flight.lon) {
    posRef.current = { lat: flight.lat, lon: flight.lon };
  }
  flightRef.current = flight;
  inZoneRef.current = isInZone;

  const buildIcon = useCallback(
    (zoneStatus: boolean) => {
      if (labelMode) {
        return createLabelIcon(flight.track, flight.aircraftType, isApproaching, isSelected, zoneStatus);
      }
      return createFlightIcon(flight.track, isApproaching, flight.aircraftType, zoneStatus, isSelected);
    },
    [flight.track, flight.aircraftType, isApproaching, isSelected, labelMode],
  );

  const checkInZoneRef = useRef(checkInZone);
  checkInZoneRef.current = checkInZone;
  const buildIconRef = useRef(buildIcon);
  buildIconRef.current = buildIcon;

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = (now - lastFrameRef.current) / 1000;
    lastFrameRef.current = now;

    const f = flightRef.current;
    const speedDegPerSec = f.speed * KNOTS_TO_DEG_PER_SEC;
    const trackRad = (f.track * Math.PI) / 180;
    const pos = posRef.current;

    pos.lat += speedDegPerSec * Math.cos(trackRad) * dt;
    pos.lon += (speedDegPerSec * Math.sin(trackRad) * dt) / Math.cos((pos.lat * Math.PI) / 180);

    markerRef.current?.setLatLng([pos.lat, pos.lon]);

    const nowInZone = checkInZoneRef.current(pos.lat, pos.lon);
    if (nowInZone !== inZoneRef.current) {
      inZoneRef.current = nowInZone;
      const newIcon = buildIconRef.current(nowInZone);
      iconRef.current = newIcon;
      markerRef.current?.setIcon(newIcon);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

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
    const newIcon = buildIcon(isInZone);
    iconRef.current = newIcon;
    return newIcon;
  }, [buildIcon, isInZone]);

  const eventHandlers = useMemo(
    () => ({
      click() {
        onSelect(flight.id);
      },
    }),
    [flight.id, onSelect]
  );

  return <Marker ref={markerRef} position={[displayLat, displayLon]} icon={icon} eventHandlers={eventHandlers} />;
}
