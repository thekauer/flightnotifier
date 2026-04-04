export interface BoundingBox {
  lamin: number; // south
  lomin: number; // west
  lamax: number; // north
  lomax: number; // east
}

export interface Flight {
  id: string; // icao24 hex
  flight?: string; // raw flight identifier from the upstream state source
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
  manufacturer: string | null; // e.g. "Boeing", "Airbus"
  registration: string | null;
  owner: string | null; // registered owner
  originCountry: string;
  origin?: string;       // departure airport ICAO code
  destination?: string;  // arrival airport ICAO code
  route?: string;        // origin -> destination display string
}
