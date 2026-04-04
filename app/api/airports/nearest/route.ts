import { NextResponse, type NextRequest } from 'next/server';
import { findNearestAirport } from '@/lib/server/airportCatalog';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const latitude = Number.parseFloat(request.nextUrl.searchParams.get('lat') ?? '');
  const longitude = Number.parseFloat(request.nextUrl.searchParams.get('lon') ?? '');

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json({ error: 'lat and lon query params are required' }, { status: 400 });
  }

  const airport = findNearestAirport(latitude, longitude);
  if (!airport) {
    return NextResponse.json({ error: 'No nearby airport found' }, { status: 404 });
  }

  return NextResponse.json(airport);
}
