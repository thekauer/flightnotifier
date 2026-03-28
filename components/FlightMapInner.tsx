'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Flight } from '@/lib/types';

const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];

const APPROACH_CONE: [number, number][] = [
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
          {flight.aircraftType && <div>Type: {flight.aircraftType}</div>}
          {flight.registration && <div>Reg: {flight.registration}</div>}
          <div>Country: {flight.originCountry}</div>
          <div>Alt: {flight.alt.toLocaleString()} ft</div>
          <div>Speed: {flight.speed} kts</div>
          <div>Heading: {flight.track}&deg;</div>
          <div>V/S: {flight.verticalRate} ft/min</div>
        </div>
      </Popup>
    </Marker>
  );
}

interface FlightMapInnerProps {
  airborneFlights: Flight[];
  approachingIds: Set<string>;
}

export default function FlightMapInner({ airborneFlights, approachingIds }: FlightMapInnerProps) {
  return (
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

      <Polygon
        positions={APPROACH_CONE}
        pathOptions={{
          color: '#16a34a',
          fillColor: '#16a34a',
          fillOpacity: 0.08,
          weight: 2,
          dashArray: '6 3',
        }}
      />

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
  );
}
