import { NextResponse } from 'next/server';
import { getActiveAirports, touchActiveAirport } from '@/server/http/services/airportActivityService';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

type AirportActivityTouchRequest = Partial<Pick<AirportSearchRecord, 'ident' | 'iata' | 'name' | 'latitude' | 'longitude'>>;

export async function handleAirportActivityGet(): Promise<Response> {
  const airports = await getActiveAirports();
  return NextResponse.json({ airports });
}

export async function handleAirportActivityPost(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as AirportActivityTouchRequest | null;
  const airportIdent = body?.ident?.trim().toUpperCase();

  if (!airportIdent || !body?.name || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
    return NextResponse.json({ error: 'Missing airport payload' }, { status: 400 });
  }

  await touchActiveAirport({
    ident: airportIdent,
    iata: body.iata?.trim().toUpperCase() || null,
    name: body.name.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
  });

  return NextResponse.json({ ok: true, airportIdent });
}
