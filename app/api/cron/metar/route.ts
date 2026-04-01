import { NextResponse } from 'next/server';
import { ingestMetar } from '@/cron/metar';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await ingestMetar();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/Metar]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
