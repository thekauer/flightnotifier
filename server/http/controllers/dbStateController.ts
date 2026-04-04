import { NextResponse } from 'next/server';
import { getDbState } from '@/server/http/services/dbStateService';

export async function handleDbStateGet(): Promise<Response> {
  return NextResponse.json(await getDbState());
}
