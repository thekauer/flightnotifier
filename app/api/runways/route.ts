import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { runways } from '@/drizzle/schema/public';
import { getRunwaysForAirportFromCatalog } from '@/lib/server/runwayCatalog';

export async function GET(request: NextRequest) {
  const airport = request.nextUrl.searchParams.get('airport');
  if (!airport) {
    return NextResponse.json({ error: 'airport query param required' }, { status: 400 });
  }

  const airportIdent = airport.toUpperCase();

  try {
    const rows = await db
      .select()
      .from(runways)
      .where(eq(runways.airportIdent, airportIdent));

    if (rows.length > 0) {
      return NextResponse.json(rows);
    }
  } catch {
    // Fall back to the local OurAirports catalog if the DB is unavailable.
  }

  return NextResponse.json(getRunwaysForAirportFromCatalog(airportIdent));
}
