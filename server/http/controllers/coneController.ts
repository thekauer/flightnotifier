import { NextResponse } from 'next/server';
import { buildConeResponse } from '@/server/http/services/coneService';

export function handleConeGet(): Response {
  return NextResponse.json(buildConeResponse());
}
