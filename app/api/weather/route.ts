import { handleDbWeatherGet } from '@/server/http/controllers/dbWeatherController';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handleDbWeatherGet();
}
