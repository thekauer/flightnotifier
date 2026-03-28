import { NextResponse } from 'next/server';
import { getWeatherCache } from '@/server/singleton';
import { getLatestWeather } from '@/server/http/services/weatherService';

export async function handleWeatherGet(): Promise<Response> {
  try {
    const weather = await getLatestWeather(getWeatherCache());
    return NextResponse.json(weather);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
