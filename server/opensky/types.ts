export interface BoundingBox {
  lamin: number; // south
  lomin: number; // west
  lamax: number; // north
  lomax: number; // east
}

export interface Flight {
  id: string; // icao24 hex
  callsign: string;
  lat: number;
  lon: number;
  alt: number; // feet
  speed: number; // knots
  track: number; // degrees, 0=north clockwise
  verticalRate: number; // ft/min
  onGround: boolean;
  timestamp: number;
  aircraftType: string | null; // ICAO designator e.g. "B788"
  registration: string | null;
  originCountry: string;
}
