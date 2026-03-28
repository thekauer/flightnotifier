import type { MetarData } from '@/lib/api/weather';
import type { WeatherCache } from '@/server/singleton';

export async function getLatestWeather(weatherCache: WeatherCache): Promise<MetarData | null> {
  return weatherCache.get();
}
