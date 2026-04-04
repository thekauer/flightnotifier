import { NextResponse, type NextRequest } from 'next/server';
import { searchAirportCatalog } from '@/lib/server/airportCatalog';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = Number.parseInt(limitParam ?? '12', 10);

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  return NextResponse.json(searchAirportCatalog(query, Number.isNaN(limit) ? 12 : limit));
}
