import { handleWeatherGet } from '@/server/http/controllers/weatherController';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleWeatherGet();
}
