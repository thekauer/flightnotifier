import { NextResponse } from 'next/server';
import { getWeatherCache } from '@/server/singleton';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const weather = await getWeatherCache().get();
    return NextResponse.json(weather);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
