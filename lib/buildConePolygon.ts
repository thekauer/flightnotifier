const DEG_TO_RAD = Math.PI / 180;
const M_PER_DEG_LAT = 111_320;

function mPerDegLon(latDeg: number): number {
  return M_PER_DEG_LAT * Math.cos(latDeg * DEG_TO_RAD);
}

export interface ConeConfig {
  threshold: [number, number];
  approachBearing: number;
  halfAngleDeg: number;
  lengthM: number;
}

export function buildConePolygon(cfg: ConeConfig): [number, number][] {
  const { threshold, approachBearing, halfAngleDeg, lengthM } = cfg;

  const lonScale = mPerDegLon(threshold[0]);

  function offset(
    origin: [number, number],
    bearingDeg: number,
    distM: number,
  ): [number, number] {
    const bearingRad = bearingDeg * DEG_TO_RAD;
    const dLat = (Math.cos(bearingRad) * distM) / M_PER_DEG_LAT;
    const dLon = (Math.sin(bearingRad) * distM) / lonScale;
    return [origin[0] + dLat, origin[1] + dLon];
  }

  const nearDist = lengthM * 0.02;
  const nearLeft = offset(threshold, approachBearing - halfAngleDeg, nearDist);
  const nearRight = offset(threshold, approachBearing + halfAngleDeg, nearDist);
  const farLeft = offset(threshold, approachBearing - halfAngleDeg, lengthM);
  const farRight = offset(threshold, approachBearing + halfAngleDeg, lengthM);

  return [nearLeft, farLeft, farRight, nearRight];
}
