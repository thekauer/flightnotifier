import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { runways } from '@/drizzle/schema/public';

export async function GET(request: NextRequest) {
  const airport = request.nextUrl.searchParams.get('airport');
  if (!airport) {
    return NextResponse.json({ error: 'airport query param required' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(runways)
    .where(eq(runways.airportIdent, airport.toUpperCase()));

  return NextResponse.json(rows);
}
