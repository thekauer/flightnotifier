import { NextResponse } from 'next/server';
import { getLatestDbWeather } from '@/server/http/services/dbStateService';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';

export async function handleDbWeatherGet(): Promise<Response> {
  return NextResponse.json(await getLatestDbWeather(DEFAULT_AIRPORT.ident));
}
