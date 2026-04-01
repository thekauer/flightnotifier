import { NextResponse } from 'next/server';
import { ingestOpenSky } from '@/cron/opensky';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await ingestOpenSky();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/OpenSky]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
