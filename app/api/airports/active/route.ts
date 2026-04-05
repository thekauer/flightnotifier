import { handleAirportActivityGet, handleAirportActivityPost } from '@/server/http/controllers/airportActivityController';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleAirportActivityGet();
}

export async function POST(request: Request) {
  return handleAirportActivityPost(request);
}
