/**
 * Generates approach-cone geometry from real runway data (OurAirports).
 *
 * The ONLY hardcoded fact is that we care about RWY 09/27 at EHAM
 * (the Buitenveldertbaan).  Everything else — thresholds, headings,
 * cone shape — is derived from the runway coordinates.
 */

// ---------------------------------------------------------------------------
// Runway endpoint data — OurAirports EHAM RWY 09/27
// LE = "09" end, HE = "27" end
// ---------------------------------------------------------------------------
const RWY_09_THRESHOLD: [number, number] = [52.31660, 4.74635]; // LE
const RWY_27_THRESHOLD: [number, number] = [52.31840, 4.79689]; // HE

// ---------------------------------------------------------------------------
// Geometric helpers (no Node-only APIs — runs in browser too)
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Metres per degree of latitude (roughly constant). */
const M_PER_DEG_LAT = 111_320;

/** Metres per degree of longitude at a given latitude. */
function mPerDegLon(latDeg: number): number {
  return M_PER_DEG_LAT * Math.cos(latDeg * DEG_TO_RAD);
}

/**
 * Compute the true bearing (degrees, 0 = N, clockwise) from point A to B.
 */
function bearing(a: [number, number], b: [number, number]): number {
  const dLat = (b[0] - a[0]) * M_PER_DEG_LAT;
  const dLon = (b[1] - a[1]) * mPerDegLon((a[0] + b[0]) / 2);
  const brg = Math.atan2(dLon, dLat) * RAD_TO_DEG;
  return (brg + 360) % 360;
}

// ---------------------------------------------------------------------------
// Cone generation
// ---------------------------------------------------------------------------

export interface ConeConfig {
  /** Threshold position [lat, lon] — the narrow end of the cone. */
  threshold: [number, number];
  /**
   * True bearing *from which* the aircraft approach (i.e. the direction the
   * plane flies along). For RWY 27 the plane flies ~267° so they come FROM
   * the east; the approach bearing here is 267° + 180° = 87° — but we
   * actually want the bearing going AWAY from the threshold (into the
   * approach path), which is the reciprocal of the landing heading.
   */
  approachBearing: number;
  /** Half-angle of the cone in degrees. */
  halfAngleDeg: number;
  /** Length of the cone in metres. */
  lengthM: number;
}

/**
 * Build a 4-vertex trapezoid (narrow end at threshold, widening away from it).
 *
 *   nearLeft ---- nearRight      (at threshold)
 *      \              /
 *       \            /
 *        \          /
 *   farLeft ---- farRight        (at lengthM away)
 *
 * Returns vertices in order: nearLeft, farLeft, farRight, nearRight
 * (a closed polygon when rendered by Leaflet).
 */
export function buildConePolygon(cfg: ConeConfig): [number, number][] {
  const { threshold, approachBearing, halfAngleDeg, lengthM } = cfg;

  const midLat = threshold[0];
  const lonScale = mPerDegLon(midLat);

  // Offset a point from origin by distance along a bearing.
  function offset(
    origin: [number, number],
    bearingDeg: number,
    distM: number,
  ): [number, number] {
    const bRad = bearingDeg * DEG_TO_RAD;
    const dLat = (Math.cos(bRad) * distM) / M_PER_DEG_LAT;
    const dLon = (Math.sin(bRad) * distM) / lonScale;
    return [origin[0] + dLat, origin[1] + dLon];
  }

  // Near end: small spread at the threshold
  // We use a tiny fraction of the length so the near end isn't a single point
  // (helps the polygon look like a proper trapezoid).
  const nearDist = lengthM * 0.02; // 2% of cone length
  const nearLeft = offset(threshold, approachBearing - halfAngleDeg, nearDist);
  const nearRight = offset(threshold, approachBearing + halfAngleDeg, nearDist);

  // Far end
  const farLeft = offset(threshold, approachBearing - halfAngleDeg, lengthM);
  const farRight = offset(threshold, approachBearing + halfAngleDeg, lengthM);

  return [nearLeft, farLeft, farRight, nearRight];
}

/**
 * Derive a bounding-box corridor from a cone polygon.
 * Returns { latMin, latMax, lonMin, lonMax }.
 */
function corridorFromPolygon(poly: [number, number][]): {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
} {
  let latMin = Infinity;
  let latMax = -Infinity;
  let lonMin = Infinity;
  let lonMax = -Infinity;
  for (const [lat, lon] of poly) {
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
    if (lon < lonMin) lonMin = lon;
    if (lon > lonMax) lonMax = lon;
  }
  return { latMin, latMax, lonMin, lonMax };
}

// ---------------------------------------------------------------------------
// Computed approach heading
// ---------------------------------------------------------------------------

/**
 * True heading when landing on each runway.
 *
 * Landing on RWY 27 means the aircraft flies ~267° (westward), which is
 * the bearing FROM the 27-end TO the 09-end.
 *
 * Landing on RWY 09 means the aircraft flies ~087° (eastward), which is
 * the bearing FROM the 09-end TO the 27-end.
 */
const RWY_27_LANDING_HEADING = bearing(RWY_27_THRESHOLD, RWY_09_THRESHOLD);
const RWY_09_LANDING_HEADING = bearing(RWY_09_THRESHOLD, RWY_27_THRESHOLD);

// ---------------------------------------------------------------------------
// Cone configuration
// ---------------------------------------------------------------------------

const CONE_HALF_ANGLE_DEG = 6; // degrees from centreline
const CONE_LENGTH_M = 28_000; // ~15 NM

// RWY 27: aircraft approach FROM the east (reciprocal of landing heading)
const RWY27_APPROACH_BEARING = (RWY_27_LANDING_HEADING + 180) % 360;

// RWY 09: aircraft approach FROM the west (reciprocal of landing heading)
const RWY09_APPROACH_BEARING = (RWY_09_LANDING_HEADING + 180) % 360;

// ---------------------------------------------------------------------------
// Exported cone polygons
// ---------------------------------------------------------------------------

/** Approach cone for RWY 27 (Buitenveldertbaan, from the east). */
export const APPROACH_CONE_27: [number, number][] = buildConePolygon({
  threshold: RWY_27_THRESHOLD,
  approachBearing: RWY27_APPROACH_BEARING,
  halfAngleDeg: CONE_HALF_ANGLE_DEG,
  lengthM: CONE_LENGTH_M,
});

/** Approach cone for RWY 09 (Buitenveldertbaan, from the west). */
export const APPROACH_CONE_09: [number, number][] = buildConePolygon({
  threshold: RWY_09_THRESHOLD,
  approachBearing: RWY09_APPROACH_BEARING,
  halfAngleDeg: CONE_HALF_ANGLE_DEG,
  lengthM: CONE_LENGTH_M,
});

/** Legacy alias — kept for backward compatibility. */
export const APPROACH_CONE = APPROACH_CONE_27;

// ---------------------------------------------------------------------------
// Exported thresholds
// ---------------------------------------------------------------------------

/** Runway 27 threshold (HE end). */
export const RWY27_THRESHOLD: [number, number] = RWY_27_THRESHOLD;

/** Runway 09 threshold (LE end). */
export const RWY09_THRESHOLD: [number, number] = RWY_09_THRESHOLD;

// ---------------------------------------------------------------------------
// Exported heading ranges (±10° from computed heading)
// ---------------------------------------------------------------------------

const HEADING_TOLERANCE = 10;

export const RWY27_MIN_HEADING = RWY_27_LANDING_HEADING - HEADING_TOLERANCE;
export const RWY27_MAX_HEADING = RWY_27_LANDING_HEADING + HEADING_TOLERANCE;
export const RWY09_MIN_HEADING = RWY_09_LANDING_HEADING - HEADING_TOLERANCE;
export const RWY09_MAX_HEADING = RWY_09_LANDING_HEADING + HEADING_TOLERANCE;

// ---------------------------------------------------------------------------
// Exported corridor bounds (bounding boxes of the cones)
// ---------------------------------------------------------------------------

const corridor27 = corridorFromPolygon(APPROACH_CONE_27);
const corridor09 = corridorFromPolygon(APPROACH_CONE_09);

export const RWY27_CORRIDOR_LAT_MIN = corridor27.latMin;
export const RWY27_CORRIDOR_LAT_MAX = corridor27.latMax;
export const RWY27_CORRIDOR_LON_MIN = corridor27.lonMin;
export const RWY27_CORRIDOR_LON_MAX = corridor27.lonMax;

export const RWY09_CORRIDOR_LAT_MIN = corridor09.latMin;
export const RWY09_CORRIDOR_LAT_MAX = corridor09.latMax;
export const RWY09_CORRIDOR_LON_MIN = corridor09.lonMin;
export const RWY09_CORRIDOR_LON_MAX = corridor09.lonMax;

// ---------------------------------------------------------------------------
// Point-in-polygon test (ray casting)
// ---------------------------------------------------------------------------

function pointInPolygon(
  lat: number,
  lon: number,
  polygon: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i]!;
    const [latJ, lonJ] = polygon[j]!;
    const intersects =
      lonI > lon !== lonJ > lon &&
      lat <
        ((latJ - latI) * (lon - lonI)) / (lonJ - lonI || Number.EPSILON) +
          latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Test whether a point is inside the RWY 27 approach cone. */
export function isInsideApproachCone27(lat: number, lon: number): boolean {
  return pointInPolygon(lat, lon, APPROACH_CONE_27);
}

/** Test whether any point in a path intersects the RWY 27 approach cone. */
export function pathIntersectsApproachCone27(
  points: Array<{ lat: number; lon: number }>,
): boolean {
  return points.some((p) => isInsideApproachCone27(p.lat, p.lon));
}
