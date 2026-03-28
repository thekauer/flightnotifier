import { NextResponse } from 'next/server';
import { buildOpenApiDocument } from '@/server/http/openapi/document';

export async function handleOpenApiGet(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  return NextResponse.json(await buildOpenApiDocument(baseUrl));
}
