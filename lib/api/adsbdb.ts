const ADSBDB_BASE_URL = 'https://api.adsbdb.com/v0';

export interface AircraftInfo {
  type: string | null;
  icaoType: string | null;
  manufacturer: string | null;
  registration: string | null;
  owner: string | null;
}

export interface RouteInfo {
  origin: string | null;
  destination: string | null;
  route: string | null;
}

interface AdsbdbAircraftResponse {
  response: {
    aircraft: {
      type: string;
      icao_type: string;
      manufacturer: string;
      mode_s: string;
      registration: string;
      registered_owner: string;
      registered_owner_country_iso_name: string;
      registered_owner_country_name: string;
      registered_owner_operator_flag_code: string;
      url_photo: string | null;
      url_photo_thumbnail: string | null;
    } | null;
  };
}

interface AdsbdbCallsignResponse {
  response: {
    flightroute: {
      callsign: string;
      callsign_icao: string | null;
      callsign_iata: string | null;
      airline: {
        name: string;
        icao: string;
        iata: string | null;
        country: string;
        country_iso: string;
        callsign: string | null;
      } | null;
      origin: {
        country_iso_name: string;
        country_name: string;
        elevation: number;
        iata_code: string;
        icao_code: string;
        latitude: number;
        longitude: number;
        municipality: string;
        name: string;
      };
      destination: {
        country_iso_name: string;
        country_name: string;
        elevation: number;
        iata_code: string;
        icao_code: string;
        latitude: number;
        longitude: number;
        municipality: string;
        name: string;
      };
    } | null;
  };
}

/**
 * Fetch aircraft metadata from adsbdb by ICAO24 hex address.
 * Returns null if the aircraft is not found.
 */
export async function fetchAircraftInfo(
  icao24: string,
): Promise<AircraftInfo | null> {
  const res = await fetch(`${ADSBDB_BASE_URL}/aircraft/${icao24}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    return null;
  }

  const data: AdsbdbAircraftResponse = await res.json();
  const aircraft = data.response?.aircraft;

  if (!aircraft) {
    return null;
  }

  return {
    type: aircraft.type || null,
    icaoType: aircraft.icao_type || null,
    manufacturer: aircraft.manufacturer || null,
    registration: aircraft.registration || null,
    owner: aircraft.registered_owner || null,
  };
}

/**
 * Fetch route info from adsbdb by callsign.
 * Returns null if the route is not found.
 */
export async function fetchRouteInfo(
  callsign: string,
): Promise<RouteInfo | null> {
  const res = await fetch(`${ADSBDB_BASE_URL}/callsign/${callsign}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    return null;
  }

  const data: AdsbdbCallsignResponse = await res.json();
  const fr = data.response?.flightroute;

  if (!fr) {
    return null;
  }

  const origin = fr.origin?.icao_code || null;
  const destination = fr.destination?.icao_code || null;
  const route = origin && destination ? `${origin} -> ${destination}` : null;

  return { origin, destination, route };
}
