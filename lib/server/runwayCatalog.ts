import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runways } from '@/drizzle/schema/public';

type RunwayRecord = typeof runways.$inferSelect;

let runwayCatalogCache: RunwayRecord[] | null = null;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseFloatValue(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function loadRunwayCatalog(): RunwayRecord[] {
  if (runwayCatalogCache) {
    return runwayCatalogCache;
  }

  const csvPath = resolve(process.cwd(), 'data/ourairports/runways.csv');
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  const catalog: RunwayRecord[] = [];

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const id = parseInteger(fields[0]);

    if (id == null) {
      continue;
    }

    catalog.push({
      id,
      airportRef: parseInteger(fields[1]),
      airportIdent: fields[2] || null,
      lengthFt: parseInteger(fields[3]),
      widthFt: parseInteger(fields[4]),
      surface: fields[5] || null,
      lighted: fields[6] === '1',
      closed: fields[7] === '1',
      leIdent: fields[8] || null,
      leLatitudeDeg: parseFloatValue(fields[9]),
      leLongitudeDeg: parseFloatValue(fields[10]),
      leElevationFt: parseFloatValue(fields[11]),
      leHeadingDegT: parseFloatValue(fields[12]),
      leDisplacedThresholdFt: parseFloatValue(fields[13]),
      heIdent: fields[14] || null,
      heLatitudeDeg: parseFloatValue(fields[15]),
      heLongitudeDeg: parseFloatValue(fields[16]),
      heElevationFt: parseFloatValue(fields[17]),
      heHeadingDegT: parseFloatValue(fields[18]),
      heDisplacedThresholdFt: parseFloatValue(fields[19]),
    });
  }

  runwayCatalogCache = catalog;
  return catalog;
}

export function getRunwaysForAirportFromCatalog(airportIdent: string): RunwayRecord[] {
  const normalizedAirportIdent = airportIdent.trim().toUpperCase();
  if (!normalizedAirportIdent) {
    return [];
  }

  return loadRunwayCatalog().filter((runway) => runway.airportIdent === normalizedAirportIdent);
}
