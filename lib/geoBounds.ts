export interface ZoneBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function parseZoneBounds(url: URL): ZoneBounds | null {
  const south = parseFloat(url.searchParams.get('south') ?? '');
  const west = parseFloat(url.searchParams.get('west') ?? '');
  const north = parseFloat(url.searchParams.get('north') ?? '');
  const east = parseFloat(url.searchParams.get('east') ?? '');

  if (Number.isNaN(south) || Number.isNaN(west) || Number.isNaN(north) || Number.isNaN(east)) {
    return null;
  }

  if (south >= north || west >= east) {
    return null;
  }

  return { south, west, north, east };
}

export function isPointInBounds(lat: number, lon: number, bounds: ZoneBounds): boolean {
  return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
}
