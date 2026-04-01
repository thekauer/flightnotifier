import { db } from '@/drizzle/db';
import { flightyArrivals } from '@/drizzle/schema/ingest';
import { extractInitialFlightsFromHtml } from '@/server/arrivals/parseHtml';

const FLIGHTY_URL = 'https://flighty.com/airports/amsterdam-schiphol-ams/arrivals';

export async function ingestFlighty(): Promise<{ inserted: number }> {
  const res = await fetch(FLIGHTY_URL, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'FlightNotifier/1.0 (+https://github.com; schedule reader)',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Flighty HTTP ${res.status}`);
  }

  const html = await res.text();
  const rows = extractInitialFlightsFromHtml(html);

  if (!rows || rows.length === 0) {
    return { inserted: 0 };
  }

  const scrapedAt = new Date();
  const values = rows.map((row) => ({
    scrapedAt,
    flightId: row.id,
    flightNumber: row.flightNumber,
    airlineIata: row.airline.iata,
    airlineName: row.airline.name,
    city: row.city,
    status: row.status,
    originalTime: row.originalTime,
    newTime: row.newTime,
    departure: row.departure,
    arrival: row.arrival,
    secondaryCorner: row.secondaryCorner ?? null,
  }));

  await db.insert(flightyArrivals).values(values);

  return { inserted: values.length };
}
