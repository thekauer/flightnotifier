/**
 * Airport database powered by OurAirports pre-processed JSON.
 * ~9,772 airports with city, countryCode, and IATA code.
 */

import airportData from '@/data/ourairports/airports-processed.json';

export interface AirportInfo {
  city: string;
  country: string;
  countryCode: string;
  /** IATA 3-letter code, e.g. "AMS", "LHR" */
  iata?: string;
}

/** Convert a 2-letter ISO country code to a flag emoji, e.g. "NL" -> "🇳🇱" */
export function countryCodeToFlag(code: string): string {
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

// ── Country code → full name mapping ──────────────────────────────────
// Covers ~60 most common aviation countries; falls back to the code itself.
const COUNTRY_NAMES: Record<string, string> = {
  AE: 'United Arab Emirates',
  AF: 'Afghanistan',
  AL: 'Albania',
  AM: 'Armenia',
  AO: 'Angola',
  AR: 'Argentina',
  AT: 'Austria',
  AU: 'Australia',
  AZ: 'Azerbaijan',
  BA: 'Bosnia and Herzegovina',
  BD: 'Bangladesh',
  BE: 'Belgium',
  BG: 'Bulgaria',
  BH: 'Bahrain',
  BR: 'Brazil',
  BY: 'Belarus',
  CA: 'Canada',
  CH: 'Switzerland',
  CL: 'Chile',
  CN: 'China',
  CO: 'Colombia',
  CR: 'Costa Rica',
  CU: 'Cuba',
  CY: 'Cyprus',
  CZ: 'Czech Republic',
  DE: 'Germany',
  DK: 'Denmark',
  DO: 'Dominican Republic',
  DZ: 'Algeria',
  EC: 'Ecuador',
  EE: 'Estonia',
  EG: 'Egypt',
  ES: 'Spain',
  ET: 'Ethiopia',
  FI: 'Finland',
  FJ: 'Fiji',
  FR: 'France',
  GB: 'United Kingdom',
  GE: 'Georgia',
  GH: 'Ghana',
  GR: 'Greece',
  GT: 'Guatemala',
  HK: 'Hong Kong',
  HN: 'Honduras',
  HR: 'Croatia',
  HU: 'Hungary',
  ID: 'Indonesia',
  IE: 'Ireland',
  IL: 'Israel',
  IN: 'India',
  IQ: 'Iraq',
  IR: 'Iran',
  IS: 'Iceland',
  IT: 'Italy',
  JM: 'Jamaica',
  JO: 'Jordan',
  JP: 'Japan',
  KE: 'Kenya',
  KG: 'Kyrgyzstan',
  KH: 'Cambodia',
  KR: 'South Korea',
  KW: 'Kuwait',
  KZ: 'Kazakhstan',
  LB: 'Lebanon',
  LK: 'Sri Lanka',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  LY: 'Libya',
  MA: 'Morocco',
  MD: 'Moldova',
  ME: 'Montenegro',
  MK: 'North Macedonia',
  MM: 'Myanmar',
  MN: 'Mongolia',
  MO: 'Macau',
  MT: 'Malta',
  MU: 'Mauritius',
  MV: 'Maldives',
  MX: 'Mexico',
  MY: 'Malaysia',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NG: 'Nigeria',
  NL: 'Netherlands',
  NO: 'Norway',
  NP: 'Nepal',
  NZ: 'New Zealand',
  OM: 'Oman',
  PA: 'Panama',
  PE: 'Peru',
  PH: 'Philippines',
  PK: 'Pakistan',
  PL: 'Poland',
  PT: 'Portugal',
  QA: 'Qatar',
  RO: 'Romania',
  RS: 'Serbia',
  RU: 'Russia',
  RW: 'Rwanda',
  SA: 'Saudi Arabia',
  SE: 'Sweden',
  SG: 'Singapore',
  SI: 'Slovenia',
  SK: 'Slovakia',
  SN: 'Senegal',
  TH: 'Thailand',
  TN: 'Tunisia',
  TR: 'Turkey',
  TW: 'Taiwan',
  TZ: 'Tanzania',
  UA: 'Ukraine',
  UG: 'Uganda',
  US: 'United States',
  UY: 'Uruguay',
  UZ: 'Uzbekistan',
  VE: 'Venezuela',
  VN: 'Vietnam',
  ZA: 'South Africa',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};

function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

// ── Lazy-loaded lookup maps ───────────────────────────────────────────

let airportCache: Record<string, AirportInfo> | undefined;

function getAirports(): Record<string, AirportInfo> {
  if (!airportCache) {
    airportCache = {};
    for (const [icao, raw] of Object.entries(airportData.airports)) {
      const entry = raw as { city: string; countryCode: string; iata?: string };
      airportCache[icao] = {
        city: entry.city,
        country: countryName(entry.countryCode),
        countryCode: entry.countryCode,
        iata: entry.iata,
      };
    }
  }
  return airportCache;
}

/** Look up airport info by ICAO code. Returns undefined if unknown. */
export function getAirportInfo(icaoCode: string): AirportInfo | undefined {
  return getAirports()[icaoCode.toUpperCase()];
}

/** Resolve ICAO from IATA when the airport exists in the database. */
export function resolveIcaoFromIata(iata: string): string | undefined {
  const map = airportData.iataToIcao as Record<string, string>;
  return map[iata.toUpperCase()];
}
