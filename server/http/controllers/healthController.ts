import { NextResponse } from 'next/server';
import { buildHealthResponse } from '@/server/http/services/healthService';

export function handleHealthGet(): Response {
  return NextResponse.json(buildHealthResponse());
}
