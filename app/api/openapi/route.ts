import { handleOpenApiGet } from '@/server/http/controllers/openapiController';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handleOpenApiGet(request);
}
