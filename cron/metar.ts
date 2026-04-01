import { db } from '@/drizzle/db';
import { metar } from '@/drizzle/schema/ingest';
import { fetchMetar } from '@/lib/api/weather';

export async function ingestMetar(): Promise<{ station: string; raw: string }> {
  const data = await fetchMetar('EHAM');

  await db.insert(metar).values({
    fetchedAt: new Date(),
    station: data.station,
    raw: data.raw,
    observationTime: new Date(data.observationTime),
    temp: data.temp,
    dewpoint: data.dewpoint,
    windDirection: data.windDirection,
    windSpeed: data.windSpeed,
    windGust: data.windGust,
    visibility: data.visibility,
    clouds: data.clouds,
    ceiling: data.ceiling,
    qnh: data.qnh,
    flightCategory: data.flightCategory,
  });

  return { station: data.station, raw: data.raw };
}
