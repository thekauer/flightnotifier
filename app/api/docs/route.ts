import { handleApiDocsGet } from '@/server/http/controllers/docsController';

export const dynamic = 'force-dynamic';

export function GET() {
  return handleApiDocsGet();
}
