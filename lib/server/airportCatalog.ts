import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

const ALLOWED_AIRPORT_TYPES = new Set([
  'large_airport',
  'medium_airport',
  'small_airport',
  'seaplane_base',
]);

const PRIMARY_NEAREST_TYPES = new Set(['large_airport', 'medium_airport']);

const AIRPORT_TYPE_RANK: Record<string, number> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
  seaplane_base: 3,
};

let airportCatalogCache: AirportSearchRecord[] | null = null;

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

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function compareAirports(a: AirportSearchRecord, b: AirportSearchRecord): number {
  if (a.scheduledService !== b.scheduledService) {
    return a.scheduledService ? -1 : 1;
  }

  const typeRankDiff = (AIRPORT_TYPE_RANK[a.type] ?? 99) - (AIRPORT_TYPE_RANK[b.type] ?? 99);
  if (typeRankDiff !== 0) {
    return typeRankDiff;
  }

  if (Boolean(a.iata) !== Boolean(b.iata)) {
    return a.iata ? -1 : 1;
  }

  return a.name.localeCompare(b.name);
}

function countryNameFromCode(countryCode: string): string {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return displayNames.of(countryCode.toUpperCase()) ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}

function readRunwayAirportIdents(): Set<string> {
  const csvPath = resolve(process.cwd(), 'data/ourairports/runways.csv');
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  const runwayAirportIdents = new Set<string>();

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const ident = fields[2]?.toUpperCase();
    if (ident) {
      runwayAirportIdents.add(ident);
    }
  }

  return runwayAirportIdents;
}

function loadAirportCatalog(): AirportSearchRecord[] {
  if (airportCatalogCache) {
    return airportCatalogCache;
  }

  const runwayAirportIdents = readRunwayAirportIdents();
  const csvPath = resolve(process.cwd(), 'data/ourairports/airports.csv');
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.replace(/\r/g, '').split('\n').filter((line) => line.trim().length > 0);
  const catalog: AirportSearchRecord[] = [];

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const ident = fields[1]?.toUpperCase();
    const type = fields[2];
    const name = fields[3];
    const latitude = Number.parseFloat(fields[4] ?? '');
    const longitude = Number.parseFloat(fields[5] ?? '');
    const countryCode = fields[8]?.toUpperCase();
    const municipality = fields[10] || null;
    const scheduledService = (fields[11] ?? '').toLowerCase() === 'yes';
    const iata = (fields[13] ?? '').trim().toUpperCase() || null;

    if (!ident || !runwayAirportIdents.has(ident)) {
      continue;
    }

    if (!ALLOWED_AIRPORT_TYPES.has(type)) {
      continue;
    }

    if (!name || !countryCode || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      continue;
    }

    catalog.push({
      ident,
      iata,
      name,
      municipality,
      countryCode,
      country: countryNameFromCode(countryCode),
      latitude,
      longitude,
      type,
      scheduledService,
    });
  }

  airportCatalogCache = catalog.sort(compareAirports);
  return airportCatalogCache;
}

function subsequenceScore(query: string, value: string): number {
  if (!query || !value) {
    return 0;
  }

  let qIndex = 0;
  let spreadPenalty = 0;
  let lastMatchIndex = -1;

  for (let i = 0; i < value.length && qIndex < query.length; i += 1) {
    if (value[i] === query[qIndex]) {
      if (lastMatchIndex >= 0) {
        spreadPenalty += i - lastMatchIndex - 1;
      }
      lastMatchIndex = i;
      qIndex += 1;
    }
  }

  if (qIndex !== query.length) {
    return 0;
  }

  return Math.max(25, 220 - spreadPenalty * 6 - (value.length - query.length));
}

function scoreAirport(query: string, airport: AirportSearchRecord): number {
  const ident = normalize(airport.ident);
  const iata = normalize(airport.iata ?? '');
  const name = normalize(airport.name);
  const municipality = normalize(airport.municipality ?? '');
  const country = normalize(airport.country);
  const combined = [ident, iata, name, municipality, country].filter(Boolean).join(' ');
  const terms = query.split(/\s+/).filter(Boolean);

  let score = 0;

  if (ident === query) score = Math.max(score, 1600);
  if (iata && iata === query) score = Math.max(score, 1700);
  if (name === query) score = Math.max(score, 1550);
  if (municipality && municipality === query) score = Math.max(score, 1350);
  if (country === query) score = Math.max(score, 1450);

  if (ident.startsWith(query)) score = Math.max(score, 1200);
  if (iata && iata.startsWith(query)) score = Math.max(score, 1325);
  if (name.startsWith(query)) score = Math.max(score, 1120);
  if (municipality && municipality.startsWith(query)) score = Math.max(score, 1000);
  if (country.startsWith(query)) score = Math.max(score, 1250);

  if (ident.includes(query)) score = Math.max(score, 900);
  if (iata && iata.includes(query)) score = Math.max(score, 940);
  if (name.includes(query)) score = Math.max(score, 760);
  if (municipality && municipality.includes(query)) score = Math.max(score, 680);
  if (country.includes(query)) score = Math.max(score, 820);

  const identSubsequenceScore = subsequenceScore(query, ident);
  const iataSubsequenceScore = subsequenceScore(query, iata);
  const nameSubsequenceScore = subsequenceScore(query, name);
  const municipalitySubsequenceScore = subsequenceScore(query, municipality);
  const countrySubsequenceScore = subsequenceScore(query, country);

  if (identSubsequenceScore > 0) score = Math.max(score, identSubsequenceScore + 240);
  if (iataSubsequenceScore > 0) score = Math.max(score, iataSubsequenceScore + 220);
  if (nameSubsequenceScore > 0) score = Math.max(score, nameSubsequenceScore);
  if (municipalitySubsequenceScore > 0) score = Math.max(score, municipalitySubsequenceScore);
  if (countrySubsequenceScore > 0) score = Math.max(score, countrySubsequenceScore + 80);

  if (terms.length > 1 && terms.every((term) => combined.includes(term))) {
    score += 140;
  }

  if (score === 0) {
    return 0;
  }

  if (airport.scheduledService) {
    score += 35;
  }

  score += Math.max(0, 20 - (AIRPORT_TYPE_RANK[airport.type] ?? 10) * 5);
  score += airport.iata ? 12 : 0;

  return score;
}

function isCountryOnlyQuery(query: string, airport: AirportSearchRecord): boolean {
  const normalizedCountry = normalize(airport.country);
  const normalizedCode = normalize(airport.countryCode);
  return query === normalizedCountry || query === normalizedCode;
}

function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusKm = 6371;
  const latA = (latitudeA * Math.PI) / 180;
  const latB = (latitudeB * Math.PI) / 180;
  const latDiff = ((latitudeB - latitudeA) * Math.PI) / 180;
  const lonDiff = ((longitudeB - longitudeA) * Math.PI) / 180;

  const a =
    Math.sin(latDiff / 2) * Math.sin(latDiff / 2) +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lonDiff / 2) * Math.sin(lonDiff / 2);

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function searchAirportCatalog(queryText: string, limit = 12): AirportSearchRecord[] {
  const query = normalize(queryText);
  if (!query) {
    return [];
  }

  const airports = loadAirportCatalog();
  const countryMatches = airports.filter((airport) => isCountryOnlyQuery(query, airport));

  if (countryMatches.length > 0) {
    return [...countryMatches].sort(compareAirports).slice(0, Math.max(limit, 50));
  }

  return airports
    .map((airport) => ({ airport, score: scoreAirport(query, airport) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return compareAirports(left.airport, right.airport);
    })
    .slice(0, limit)
    .map((entry) => entry.airport);
}

export function findNearestAirport(latitude: number, longitude: number): AirportSearchRecord | null {
  const airports = loadAirportCatalog();

  const primaryCandidates = airports.filter(
    (airport) => PRIMARY_NEAREST_TYPES.has(airport.type) && (airport.scheduledService || Boolean(airport.iata)),
  );

  const primaryNearest = primaryCandidates.reduce<{ airport: AirportSearchRecord | null; distanceKm: number }>(
    (best, airport) => {
      const distanceKm = haversineDistanceKm(latitude, longitude, airport.latitude, airport.longitude);
      if (distanceKm < best.distanceKm) {
        return { airport, distanceKm };
      }
      return best;
    },
    { airport: null, distanceKm: Number.POSITIVE_INFINITY },
  );

  if (primaryNearest.airport && primaryNearest.distanceKm <= 120) {
    return primaryNearest.airport;
  }

  return airports.reduce<{ airport: AirportSearchRecord | null; distanceKm: number }>(
    (best, airport) => {
      const distanceKm = haversineDistanceKm(latitude, longitude, airport.latitude, airport.longitude);
      if (distanceKm < best.distanceKm) {
        return { airport, distanceKm };
      }
      return best;
    },
    { airport: null, distanceKm: Number.POSITIVE_INFINITY },
  ).airport;
}
