import { NextResponse } from 'next/server';
import { ingestAdsbdb } from '@/cron/adsbdb';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await ingestAdsbdb();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/ADSBDB]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
