import { EHAM_RUNWAYS, FT_TO_M, M_PER_DEG_LAT, RUNWAY_WIDTH_SCALE } from './mapConstants';

/**
 * Compute the 4 corners of a runway rectangle from its centerline endpoints and width.
 * Returns corners in order suitable for a Leaflet Polygon: LE-left, LE-right, HE-right, HE-left.
 */
export function runwayPolygon(le: [number, number], he: [number, number], widthFt: number): [number, number][] {
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
export const EHAM_RUNWAY_POLYGONS = EHAM_RUNWAYS.map((rwy) => ({
  ...rwy,
  corners: runwayPolygon(rwy.le, rwy.he, rwy.widthFt * RUNWAY_WIDTH_SCALE),
}));

/**
 * Knots -> degrees-per-second conversion factor.
 * 1 knot = 1.852 km/h; 1 degree latitude ~ 111 320 m.
 * So deg/s = (speed_kts * 1.852 * 1000) / (111320 * 3600).
 */
export const KNOTS_TO_DEG_PER_SEC = (1.852 * 1000) / (111_320 * 3600);

/** Interpolate a flight's lat/lon from its last-known state + elapsed time. */
export function interpolatePosition(
  lat: number,
  lon: number,
  speed: number,
  track: number,
  elapsedSec: number
): [number, number] {
  const speedDegPerSec = speed * KNOTS_TO_DEG_PER_SEC;
  const trackRad = (track * Math.PI) / 180;
  // track 0 = north, so lat uses cos(track) and lon uses sin(track)
  const newLat = lat + speedDegPerSec * Math.cos(trackRad) * elapsedSec;
  const newLon = lon + (speedDegPerSec * Math.sin(trackRad) * elapsedSec) / Math.cos((lat * Math.PI) / 180);
  return [newLat, newLon];
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
