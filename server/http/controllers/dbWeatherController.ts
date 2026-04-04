import { NextResponse } from 'next/server';
import { getLatestDbWeather } from '@/server/http/services/dbStateService';

export async function handleDbWeatherGet(): Promise<Response> {
  return NextResponse.json(await getLatestDbWeather());
}
