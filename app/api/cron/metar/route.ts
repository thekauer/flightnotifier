import { NextResponse } from 'next/server';
import { ingestMetar } from '@/cron/metar';
import { authorizeCron } from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';

async function handleCron(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const result = await ingestMetar();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Cron/Metar]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
