export function smoothPolyline(
  points: [number, number][],
  segmentsPerStep: number,
): [number, number][] {
  if (points.length < 4 || segmentsPerStep <= 1) {
    return points;
  }

  const smoothed: [number, number][] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(points.length - 1, index + 2)]!;

    for (let step = 0; step < segmentsPerStep; step += 1) {
      const t = step / segmentsPerStep;
      const t2 = t * t;
      const t3 = t2 * t;
      const lat =
        0.5 *
        ((2 * p1[0]) +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const lon =
        0.5 *
        ((2 * p1[1]) +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      smoothed.push([lat, lon]);
    }
  }

  smoothed.push(points[points.length - 1]!);
  return smoothed;
}
