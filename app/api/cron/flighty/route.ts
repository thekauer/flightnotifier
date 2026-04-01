import { NextResponse } from 'next/server';
import { ingestFlighty } from '@/cron/flighty';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const result = await ingestFlighty();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/Flighty]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
