import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { FlightState, LiveFeedFlight } from '../types';

const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];

const APPROACH_BOUNDS: [[number, number], [number, number]] = [
  [52.2, 4.6],
  [52.45, 5.1],
];

const APPROACH_PATH: [number, number][] = [
  [52.31, 4.77],
  [52.31, 4.9],
  [52.31, 5.05],
  [52.32, 5.2],
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
      [52.0, 4.2],
      [52.6, 5.4],
    ]);
  }, [map]);
  return null;
}

function FlightMarker({
  flight,
  isApproaching,
}: {
  flight: LiveFeedFlight;
  isApproaching: boolean;
}) {
  const icon = useMemo(
    () => createFlightIcon(flight.track, isApproaching),
    [flight.track, isApproaching],
  );

  return (
    <Marker position={[flight.lat, flight.lon]} icon={icon}>
      <Popup>
        <div className="text-xs">
          <div className="font-bold">{flight.extraInfo?.flight || flight.callsign}</div>
          <div>Callsign: {flight.callsign}</div>
          {flight.extraInfo?.type && <div>Type: {flight.extraInfo.type}</div>}
          {flight.extraInfo?.reg && <div>Reg: {flight.extraInfo.reg}</div>}
          {flight.extraInfo?.route && (
            <div>
              Route: {flight.extraInfo.route.from || '?'} &rarr;{' '}
              {flight.extraInfo.route.to || '?'}
            </div>
          )}
          <div>Alt: {flight.alt} ft</div>
          <div>Speed: {flight.speed} kts</div>
          <div>Heading: {flight.track}&deg;</div>
        </div>
      </Popup>
    </Marker>
  );
}

interface FlightMapProps {
  state: FlightState;
}

export function FlightMap({ state }: FlightMapProps) {
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.flightId)),
    [state.approachingFlights],
  );

  const airborneFlights = useMemo(
    () => state.allFlights.filter((f) => !f.onGround),
    [state.allFlights],
  );

  return (
    <MapContainer
      center={SCHIPHOL_POS}
      zoom={10}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds />

      {/* Approach bounding box */}
      <Rectangle bounds={APPROACH_BOUNDS} pathOptions={{ color: '#4f46e5', fillOpacity: 0.05, weight: 1 }} />

      {/* Approach path */}
      <Polyline
        positions={APPROACH_PATH}
        pathOptions={{ color: '#16a34a', dashArray: '8 4', weight: 2 }}
      />

      {/* Schiphol marker */}
      <Marker position={SCHIPHOL_POS} icon={schipholIcon}>
        <Popup>
          <strong>Schiphol Airport (AMS)</strong>
          <br />
          Runway 09 / Buitenveldertbaan
        </Popup>
      </Marker>

      {/* Flight markers */}
      {airborneFlights.map((flight) => (
        <FlightMarker
          key={flight.flightId}
          flight={flight}
          isApproaching={approachingIds.has(flight.flightId)}
        />
      ))}
    </MapContainer>
  );
}
