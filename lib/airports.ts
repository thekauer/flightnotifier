/**
 * ICAO airport code database with city, country, and ISO country code.
 * Covers major European airports (especially Schiphol routes), worldwide hubs.
 */

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

/** Look up airport info by ICAO code. Returns undefined if unknown. */
export function getAirportInfo(icaoCode: string): AirportInfo | undefined {
  return AIRPORTS[icaoCode.toUpperCase()];
}

const AIRPORTS: Record<string, AirportInfo> = {
  // ── Netherlands ──────────────────────────────────────────────
  EHAM: { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', iata: 'AMS' },
  EHRD: { city: 'Rotterdam', country: 'Netherlands', countryCode: 'NL', iata: 'RTM' },
  EHEH: { city: 'Eindhoven', country: 'Netherlands', countryCode: 'NL', iata: 'EIN' },
  EHGG: { city: 'Groningen', country: 'Netherlands', countryCode: 'NL', iata: 'GRQ' },
  EHBK: { city: 'Maastricht', country: 'Netherlands', countryCode: 'NL', iata: 'MST' },
  EHLW: { city: 'Leeuwarden', country: 'Netherlands', countryCode: 'NL', iata: 'LWR' },
  EHLE: { city: 'Lelystad', country: 'Netherlands', countryCode: 'NL', iata: 'LEY' },

  // ── Belgium ──────────────────────────────────────────────────
  EBBR: { city: 'Brussels', country: 'Belgium', countryCode: 'BE', iata: 'BRU' },
  EBCI: { city: 'Charleroi', country: 'Belgium', countryCode: 'BE', iata: 'CRL' },
  EBAW: { city: 'Antwerp', country: 'Belgium', countryCode: 'BE', iata: 'ANR' },
  EBLG: { city: 'Liège', country: 'Belgium', countryCode: 'BE', iata: 'LGG' },
  EBOS: { city: 'Ostend', country: 'Belgium', countryCode: 'BE', iata: 'OST' },

  // ── Germany ──────────────────────────────────────────────────
  EDDF: { city: 'Frankfurt', country: 'Germany', countryCode: 'DE', iata: 'FRA' },
  EDDM: { city: 'Munich', country: 'Germany', countryCode: 'DE', iata: 'MUC' },
  EDDB: { city: 'Berlin', country: 'Germany', countryCode: 'DE', iata: 'BER' },
  EDDL: { city: 'Düsseldorf', country: 'Germany', countryCode: 'DE', iata: 'DUS' },
  EDDH: { city: 'Hamburg', country: 'Germany', countryCode: 'DE', iata: 'HAM' },
  EDDK: { city: 'Cologne', country: 'Germany', countryCode: 'DE', iata: 'CGN' },
  EDDS: { city: 'Stuttgart', country: 'Germany', countryCode: 'DE', iata: 'STR' },
  EDDW: { city: 'Bremen', country: 'Germany', countryCode: 'DE', iata: 'BRE' },
  EDDN: { city: 'Nuremberg', country: 'Germany', countryCode: 'DE', iata: 'NUE' },
  EDDP: { city: 'Leipzig', country: 'Germany', countryCode: 'DE', iata: 'LEJ' },
  EDDC: { city: 'Dresden', country: 'Germany', countryCode: 'DE', iata: 'DRS' },
  EDDE: { city: 'Erfurt', country: 'Germany', countryCode: 'DE', iata: 'ERF' },
  EDDG: { city: 'Münster', country: 'Germany', countryCode: 'DE', iata: 'FMO' },
  EDDR: { city: 'Saarbrücken', country: 'Germany', countryCode: 'DE', iata: 'SCN' },
  EDDT: { city: 'Berlin Tegel', country: 'Germany', countryCode: 'DE', iata: 'TXL' },
  EDLW: { city: 'Dortmund', country: 'Germany', countryCode: 'DE', iata: 'DTM' },
  EDFH: { city: 'Frankfurt-Hahn', country: 'Germany', countryCode: 'DE', iata: 'HHN' },
  EDLP: { city: 'Paderborn', country: 'Germany', countryCode: 'DE', iata: 'PAD' },
  EDNY: { city: 'Friedrichshafen', country: 'Germany', countryCode: 'DE', iata: 'FDH' },

  // ── United Kingdom ───────────────────────────────────────────
  EGLL: { city: 'London Heathrow', country: 'United Kingdom', countryCode: 'GB', iata: 'LHR' },
  EGKK: { city: 'London Gatwick', country: 'United Kingdom', countryCode: 'GB', iata: 'LGW' },
  EGSS: { city: 'London Stansted', country: 'United Kingdom', countryCode: 'GB', iata: 'STN' },
  EGGW: { city: 'London Luton', country: 'United Kingdom', countryCode: 'GB', iata: 'LTN' },
  EGLC: { city: 'London City', country: 'United Kingdom', countryCode: 'GB', iata: 'LCY' },
  EGCC: { city: 'Manchester', country: 'United Kingdom', countryCode: 'GB', iata: 'MAN' },
  EGBB: { city: 'Birmingham', country: 'United Kingdom', countryCode: 'GB', iata: 'BHX' },
  EGPH: { city: 'Edinburgh', country: 'United Kingdom', countryCode: 'GB', iata: 'EDI' },
  EGPF: { city: 'Glasgow', country: 'United Kingdom', countryCode: 'GB', iata: 'GLA' },
  EGGD: { city: 'Bristol', country: 'United Kingdom', countryCode: 'GB', iata: 'BRS' },
  EGNX: { city: 'East Midlands', country: 'United Kingdom', countryCode: 'GB', iata: 'EMA' },
  EGNT: { city: 'Newcastle', country: 'United Kingdom', countryCode: 'GB', iata: 'NCL' },
  EGNM: { city: 'Leeds', country: 'United Kingdom', countryCode: 'GB', iata: 'LBA' },
  EGGP: { city: 'Liverpool', country: 'United Kingdom', countryCode: 'GB', iata: 'LPL' },
  EGAA: { city: 'Belfast', country: 'United Kingdom', countryCode: 'GB', iata: 'BFS' },
  EGAC: { city: 'Belfast City', country: 'United Kingdom', countryCode: 'GB', iata: 'BHD' },
  EGPD: { city: 'Aberdeen', country: 'United Kingdom', countryCode: 'GB', iata: 'ABZ' },
  EGHI: { city: 'Southampton', country: 'United Kingdom', countryCode: 'GB', iata: 'SOU' },
  EGHH: { city: 'Bournemouth', country: 'United Kingdom', countryCode: 'GB', iata: 'BOH' },
  EGNJ: { city: 'Humberside', country: 'United Kingdom', countryCode: 'GB', iata: 'HUY' },
  EGSH: { city: 'Norwich', country: 'United Kingdom', countryCode: 'GB', iata: 'NWI' },
  EGTE: { city: 'Exeter', country: 'United Kingdom', countryCode: 'GB', iata: 'EXT' },
  EGCN: { city: 'Doncaster', country: 'United Kingdom', countryCode: 'GB', iata: 'DSA' },

  // ── France ───────────────────────────────────────────────────
  LFPG: { city: 'Paris CDG', country: 'France', countryCode: 'FR', iata: 'CDG' },
  LFPO: { city: 'Paris Orly', country: 'France', countryCode: 'FR', iata: 'ORY' },
  LFML: { city: 'Marseille', country: 'France', countryCode: 'FR', iata: 'MRS' },
  LFLL: { city: 'Lyon', country: 'France', countryCode: 'FR', iata: 'LYS' },
  LFMN: { city: 'Nice', country: 'France', countryCode: 'FR', iata: 'NCE' },
  LFBO: { city: 'Toulouse', country: 'France', countryCode: 'FR', iata: 'TLS' },
  LFBD: { city: 'Bordeaux', country: 'France', countryCode: 'FR', iata: 'BOD' },
  LFRS: { city: 'Nantes', country: 'France', countryCode: 'FR', iata: 'NTE' },
  LFSB: { city: 'Basel/Mulhouse', country: 'France', countryCode: 'FR', iata: 'BSL' },
  LFST: { city: 'Strasbourg', country: 'France', countryCode: 'FR', iata: 'SXB' },
  LFRB: { city: 'Brest', country: 'France', countryCode: 'FR', iata: 'BES' },
  LFPB: { city: 'Paris Le Bourget', country: 'France', countryCode: 'FR', iata: 'LBG' },
  LFMK: { city: 'Carcassonne', country: 'France', countryCode: 'FR', iata: 'CCF' },
  LFMP: { city: 'Perpignan', country: 'France', countryCode: 'FR', iata: 'PGF' },
  LFBI: { city: 'Poitiers', country: 'France', countryCode: 'FR', iata: 'PIS' },
  LFLC: { city: 'Clermont-Ferrand', country: 'France', countryCode: 'FR', iata: 'CFE' },

  // ── Spain ────────────────────────────────────────────────────
  LEMD: { city: 'Madrid', country: 'Spain', countryCode: 'ES', iata: 'MAD' },
  LEBL: { city: 'Barcelona', country: 'Spain', countryCode: 'ES', iata: 'BCN' },
  LEPA: { city: 'Palma de Mallorca', country: 'Spain', countryCode: 'ES', iata: 'PMI' },
  LEMG: { city: 'Málaga', country: 'Spain', countryCode: 'ES', iata: 'AGP' },
  LEAL: { city: 'Alicante', country: 'Spain', countryCode: 'ES', iata: 'ALC' },
  GCTS: { city: 'Tenerife South', country: 'Spain', countryCode: 'ES', iata: 'TFS' },
  GCXO: { city: 'Tenerife North', country: 'Spain', countryCode: 'ES', iata: 'TFN' },
  GCLP: { city: 'Gran Canaria', country: 'Spain', countryCode: 'ES', iata: 'LPA' },
  GCFV: { city: 'Fuerteventura', country: 'Spain', countryCode: 'ES', iata: 'FUE' },
  GCRR: { city: 'Lanzarote', country: 'Spain', countryCode: 'ES', iata: 'ACE' },
  LEZL: { city: 'Seville', country: 'Spain', countryCode: 'ES', iata: 'SVQ' },
  LEBB: { city: 'Bilbao', country: 'Spain', countryCode: 'ES', iata: 'BIO' },
  LEVX: { city: 'Vigo', country: 'Spain', countryCode: 'ES', iata: 'VGO' },
  LEVC: { city: 'Valencia', country: 'Spain', countryCode: 'ES', iata: 'VLC' },
  LEGE: { city: 'Girona', country: 'Spain', countryCode: 'ES', iata: 'GRO' },
  LERS: { city: 'Reus', country: 'Spain', countryCode: 'ES', iata: 'REU' },
  LEIB: { city: 'Ibiza', country: 'Spain', countryCode: 'ES', iata: 'IBZ' },
  LEMH: { city: 'Menorca', country: 'Spain', countryCode: 'ES', iata: 'MAH' },

  // ── Italy ────────────────────────────────────────────────────
  LIRF: { city: 'Rome Fiumicino', country: 'Italy', countryCode: 'IT', iata: 'FCO' },
  LIMC: { city: 'Milan Malpensa', country: 'Italy', countryCode: 'IT', iata: 'MXP' },
  LIME: { city: 'Milan Bergamo', country: 'Italy', countryCode: 'IT', iata: 'BGY' },
  LIPZ: { city: 'Venice', country: 'Italy', countryCode: 'IT', iata: 'VCE' },
  LIPE: { city: 'Bologna', country: 'Italy', countryCode: 'IT', iata: 'BLQ' },
  LIRN: { city: 'Naples', country: 'Italy', countryCode: 'IT', iata: 'NAP' },
  LIML: { city: 'Milan Linate', country: 'Italy', countryCode: 'IT', iata: 'LIN' },
  LIRP: { city: 'Pisa', country: 'Italy', countryCode: 'IT', iata: 'PSA' },
  LICJ: { city: 'Palermo', country: 'Italy', countryCode: 'IT', iata: 'PMO' },
  LICC: { city: 'Catania', country: 'Italy', countryCode: 'IT', iata: 'CTA' },
  LIPX: { city: 'Verona', country: 'Italy', countryCode: 'IT', iata: 'VRN' },
  LIRA: { city: 'Rome Ciampino', country: 'Italy', countryCode: 'IT', iata: 'CIA' },
  LIBD: { city: 'Bari', country: 'Italy', countryCode: 'IT', iata: 'BRI' },
  LIBR: { city: 'Brindisi', country: 'Italy', countryCode: 'IT', iata: 'BDS' },
  LICA: { city: 'Lamezia Terme', country: 'Italy', countryCode: 'IT', iata: 'SUF' },
  LIEA: { city: 'Alghero', country: 'Italy', countryCode: 'IT', iata: 'AHO' },
  LIEE: { city: 'Cagliari', country: 'Italy', countryCode: 'IT', iata: 'CAG' },
  LIPO: { city: 'Brescia', country: 'Italy', countryCode: 'IT', iata: 'VBS' },
  LIMF: { city: 'Turin', country: 'Italy', countryCode: 'IT', iata: 'TRN' },
  LIMJ: { city: 'Genoa', country: 'Italy', countryCode: 'IT', iata: 'GOA' },
  LIEO: { city: 'Olbia', country: 'Italy', countryCode: 'IT', iata: 'OLB' },

  // ── Portugal ─────────────────────────────────────────────────
  LPPT: { city: 'Lisbon', country: 'Portugal', countryCode: 'PT', iata: 'LIS' },
  LPPR: { city: 'Porto', country: 'Portugal', countryCode: 'PT', iata: 'OPO' },
  LPFR: { city: 'Faro', country: 'Portugal', countryCode: 'PT', iata: 'FAO' },
  LPMA: { city: 'Funchal', country: 'Portugal', countryCode: 'PT', iata: 'FNC' },
  LPPD: { city: 'Ponta Delgada', country: 'Portugal', countryCode: 'PT', iata: 'PDL' },

  // ── Switzerland ──────────────────────────────────────────────
  LSZH: { city: 'Zürich', country: 'Switzerland', countryCode: 'CH', iata: 'ZRH' },
  LSGG: { city: 'Geneva', country: 'Switzerland', countryCode: 'CH', iata: 'GVA' },
  LSZB: { city: 'Bern', country: 'Switzerland', countryCode: 'CH', iata: 'BRN' },

  // ── Austria ──────────────────────────────────────────────────
  LOWW: { city: 'Vienna', country: 'Austria', countryCode: 'AT', iata: 'VIE' },
  LOWS: { city: 'Salzburg', country: 'Austria', countryCode: 'AT', iata: 'SZG' },
  LOWG: { city: 'Graz', country: 'Austria', countryCode: 'AT', iata: 'GRZ' },
  LOWI: { city: 'Innsbruck', country: 'Austria', countryCode: 'AT', iata: 'INN' },
  LOWL: { city: 'Linz', country: 'Austria', countryCode: 'AT', iata: 'LNZ' },

  // ── Ireland ──────────────────────────────────────────────────
  EIDW: { city: 'Dublin', country: 'Ireland', countryCode: 'IE', iata: 'DUB' },
  EICK: { city: 'Cork', country: 'Ireland', countryCode: 'IE', iata: 'ORK' },
  EINN: { city: 'Shannon', country: 'Ireland', countryCode: 'IE', iata: 'SNN' },
  EIKN: { city: 'Knock', country: 'Ireland', countryCode: 'IE', iata: 'NOC' },

  // ── Scandinavia ──────────────────────────────────────────────
  EKCH: { city: 'Copenhagen', country: 'Denmark', countryCode: 'DK', iata: 'CPH' },
  EKBI: { city: 'Billund', country: 'Denmark', countryCode: 'DK', iata: 'BLL' },
  EKAH: { city: 'Aarhus', country: 'Denmark', countryCode: 'DK', iata: 'AAR' },
  ESSA: { city: 'Stockholm Arlanda', country: 'Sweden', countryCode: 'SE', iata: 'ARN' },
  ESGG: { city: 'Gothenburg', country: 'Sweden', countryCode: 'SE', iata: 'GOT' },
  ESMS: { city: 'Malmö', country: 'Sweden', countryCode: 'SE', iata: 'MMX' },
  ENGM: { city: 'Oslo', country: 'Norway', countryCode: 'NO', iata: 'OSL' },
  ENBR: { city: 'Bergen', country: 'Norway', countryCode: 'NO', iata: 'BGO' },
  ENZV: { city: 'Stavanger', country: 'Norway', countryCode: 'NO', iata: 'SVG' },
  ENVA: { city: 'Trondheim', country: 'Norway', countryCode: 'NO', iata: 'TRD' },
  ENTC: { city: 'Tromsø', country: 'Norway', countryCode: 'NO', iata: 'TOS' },
  EFHK: { city: 'Helsinki', country: 'Finland', countryCode: 'FI', iata: 'HEL' },
  EFTU: { city: 'Turku', country: 'Finland', countryCode: 'FI', iata: 'TKU' },
  EFOU: { city: 'Oulu', country: 'Finland', countryCode: 'FI', iata: 'OUL' },
  BIRK: { city: 'Reykjavik', country: 'Iceland', countryCode: 'IS', iata: 'RKV' },
  BIKF: { city: 'Keflavik', country: 'Iceland', countryCode: 'IS', iata: 'KEF' },

  // ── Eastern Europe ───────────────────────────────────────────
  EPWA: { city: 'Warsaw', country: 'Poland', countryCode: 'PL', iata: 'WAW' },
  EPKK: { city: 'Krakow', country: 'Poland', countryCode: 'PL', iata: 'KRK' },
  EPGD: { city: 'Gdansk', country: 'Poland', countryCode: 'PL', iata: 'GDN' },
  EPWR: { city: 'Wroclaw', country: 'Poland', countryCode: 'PL', iata: 'WRO' },
  EPPO: { city: 'Poznan', country: 'Poland', countryCode: 'PL', iata: 'POZ' },
  EPKT: { city: 'Katowice', country: 'Poland', countryCode: 'PL', iata: 'KTW' },
  LKPR: { city: 'Prague', country: 'Czech Republic', countryCode: 'CZ', iata: 'PRG' },
  LKMT: { city: 'Ostrava', country: 'Czech Republic', countryCode: 'CZ', iata: 'OSR' },
  LZIB: { city: 'Bratislava', country: 'Slovakia', countryCode: 'SK', iata: 'BTS' },
  LZTT: { city: 'Poprad', country: 'Slovakia', countryCode: 'SK', iata: 'TAT' },
  LHBP: { city: 'Budapest', country: 'Hungary', countryCode: 'HU', iata: 'BUD' },
  LROP: { city: 'Bucharest', country: 'Romania', countryCode: 'RO', iata: 'OTP' },
  LRCK: { city: 'Constanta', country: 'Romania', countryCode: 'RO', iata: 'CND' },
  LRCL: { city: 'Cluj-Napoca', country: 'Romania', countryCode: 'RO', iata: 'CLJ' },
  LBSF: { city: 'Sofia', country: 'Bulgaria', countryCode: 'BG', iata: 'SOF' },
  LBWN: { city: 'Varna', country: 'Bulgaria', countryCode: 'BG', iata: 'VAR' },
  LBBG: { city: 'Burgas', country: 'Bulgaria', countryCode: 'BG', iata: 'BOJ' },
  LDZA: { city: 'Zagreb', country: 'Croatia', countryCode: 'HR', iata: 'ZAG' },
  LDSP: { city: 'Split', country: 'Croatia', countryCode: 'HR', iata: 'SPU' },
  LDDU: { city: 'Dubrovnik', country: 'Croatia', countryCode: 'HR', iata: 'DBV' },
  LJLJ: { city: 'Ljubljana', country: 'Slovenia', countryCode: 'SI', iata: 'LJU' },
  LYBE: { city: 'Belgrade', country: 'Serbia', countryCode: 'RS', iata: 'BEG' },
  UKBB: { city: 'Kyiv Boryspil', country: 'Ukraine', countryCode: 'UA', iata: 'KBP' },
  UKKK: { city: 'Kyiv Zhuliany', country: 'Ukraine', countryCode: 'UA', iata: 'IEV' },
  UKLL: { city: 'Lviv', country: 'Ukraine', countryCode: 'UA', iata: 'LWO' },
  EYVI: { city: 'Vilnius', country: 'Lithuania', countryCode: 'LT', iata: 'VNO' },
  EYKA: { city: 'Kaunas', country: 'Lithuania', countryCode: 'LT', iata: 'KUN' },
  EVRA: { city: 'Riga', country: 'Latvia', countryCode: 'LV', iata: 'RIX' },
  EETN: { city: 'Tallinn', country: 'Estonia', countryCode: 'EE', iata: 'TLL' },

  // ── Baltics & Luxembourg ─────────────────────────────────────
  ELLX: { city: 'Luxembourg', country: 'Luxembourg', countryCode: 'LU', iata: 'LUX' },

  // ── Greece & Cyprus ──────────────────────────────────────────
  LGAV: { city: 'Athens', country: 'Greece', countryCode: 'GR', iata: 'ATH' },
  LGTS: { city: 'Thessaloniki', country: 'Greece', countryCode: 'GR', iata: 'SKG' },
  LGIR: { city: 'Heraklion', country: 'Greece', countryCode: 'GR', iata: 'HER' },
  LGKR: { city: 'Corfu', country: 'Greece', countryCode: 'GR', iata: 'CFU' },
  LGKO: { city: 'Kos', country: 'Greece', countryCode: 'GR', iata: 'KGS' },
  LGRP: { city: 'Rhodes', country: 'Greece', countryCode: 'GR', iata: 'RHO' },
  LGMK: { city: 'Mykonos', country: 'Greece', countryCode: 'GR', iata: 'JMK' },
  LGSR: { city: 'Santorini', country: 'Greece', countryCode: 'GR', iata: 'JTR' },
  LGSA: { city: 'Chania', country: 'Greece', countryCode: 'GR', iata: 'CHQ' },
  LGZA: { city: 'Zakynthos', country: 'Greece', countryCode: 'GR', iata: 'ZTH' },
  LCLK: { city: 'Larnaca', country: 'Cyprus', countryCode: 'CY', iata: 'LCA' },
  LCPH: { city: 'Paphos', country: 'Cyprus', countryCode: 'CY', iata: 'PFO' },
  LCEN: { city: 'Ercan', country: 'Cyprus', countryCode: 'CY', iata: 'ECN' },

  // ── Turkey ───────────────────────────────────────────────────
  LTFM: { city: 'Istanbul', country: 'Turkey', countryCode: 'TR', iata: 'IST' },
  LTBA: { city: 'Istanbul Atatürk', country: 'Turkey', countryCode: 'TR', iata: 'ISL' },
  LTAI: { city: 'Antalya', country: 'Turkey', countryCode: 'TR', iata: 'AYT' },
  LTAC: { city: 'Ankara', country: 'Turkey', countryCode: 'TR', iata: 'ESB' },
  LTBJ: { city: 'Izmir', country: 'Turkey', countryCode: 'TR', iata: 'ADB' },
  LTFE: { city: 'Dalaman', country: 'Turkey', countryCode: 'TR', iata: 'DLM' },
  LTBS: { city: 'Bodrum', country: 'Turkey', countryCode: 'TR', iata: 'BJV' },

  // ── Malta ────────────────────────────────────────────────────
  LMML: { city: 'Malta', country: 'Malta', countryCode: 'MT', iata: 'MLA' },

  // ── Middle East ──────────────────────────────────────────────
  OMDB: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', iata: 'DXB' },
  OMAA: { city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', iata: 'AUH' },
  OMSJ: { city: 'Sharjah', country: 'United Arab Emirates', countryCode: 'AE', iata: 'SHJ' },
  OTHH: { city: 'Doha', country: 'Qatar', countryCode: 'QA', iata: 'DOH' },
  OERK: { city: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', iata: 'RUH' },
  OEJN: { city: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', iata: 'JED' },
  OBBI: { city: 'Bahrain', country: 'Bahrain', countryCode: 'BH', iata: 'BAH' },
  OOMS: { city: 'Muscat', country: 'Oman', countryCode: 'OM', iata: 'MCT' },
  OKBK: { city: 'Kuwait', country: 'Kuwait', countryCode: 'KW', iata: 'KWI' },
  LLBG: { city: 'Tel Aviv', country: 'Israel', countryCode: 'IL', iata: 'TLV' },
  OLBA: { city: 'Beirut', country: 'Lebanon', countryCode: 'LB', iata: 'BEY' },
  OJAM: { city: 'Amman', country: 'Jordan', countryCode: 'JO', iata: 'AMM' },
  OIIE: { city: 'Tehran', country: 'Iran', countryCode: 'IR', iata: 'IKA' },

  // ── Africa ───────────────────────────────────────────────────
  HECA: { city: 'Cairo', country: 'Egypt', countryCode: 'EG', iata: 'CAI' },
  HEGN: { city: 'Hurghada', country: 'Egypt', countryCode: 'EG', iata: 'HRG' },
  HESH: { city: 'Sharm el-Sheikh', country: 'Egypt', countryCode: 'EG', iata: 'SSH' },
  GMMN: { city: 'Casablanca', country: 'Morocco', countryCode: 'MA', iata: 'CMN' },
  GMME: { city: 'Rabat', country: 'Morocco', countryCode: 'MA', iata: 'RBA' },
  GMMX: { city: 'Marrakech', country: 'Morocco', countryCode: 'MA', iata: 'RAK' },
  DTTA: { city: 'Tunis', country: 'Tunisia', countryCode: 'TN', iata: 'TUN' },
  DAAG: { city: 'Algiers', country: 'Algeria', countryCode: 'DZ', iata: 'ALG' },
  HAAB: { city: 'Addis Ababa', country: 'Ethiopia', countryCode: 'ET', iata: 'ADD' },
  HKJK: { city: 'Nairobi', country: 'Kenya', countryCode: 'KE', iata: 'NBO' },
  DNMM: { city: 'Lagos', country: 'Nigeria', countryCode: 'NG', iata: 'LOS' },
  DNAA: { city: 'Abuja', country: 'Nigeria', countryCode: 'NG', iata: 'ABV' },
  FAOR: { city: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', iata: 'JNB' },
  FACT: { city: 'Cape Town', country: 'South Africa', countryCode: 'ZA', iata: 'CPT' },
  GOOY: { city: 'Dakar', country: 'Senegal', countryCode: 'SN', iata: 'DSS' },
  DIAP: { city: 'Abidjan', country: 'Ivory Coast', countryCode: 'CI', iata: 'ABJ' },
  DGAA: { city: 'Accra', country: 'Ghana', countryCode: 'GH', iata: 'ACC' },
  HTDA: { city: 'Dar es Salaam', country: 'Tanzania', countryCode: 'TZ', iata: 'DAR' },
  FMEE: { city: 'Mauritius', country: 'Mauritius', countryCode: 'MU', iata: 'MRU' },
  HRYR: { city: 'Kigali', country: 'Rwanda', countryCode: 'RW', iata: 'KGL' },

  // ── North America ────────────────────────────────────────────
  KJFK: { city: 'New York JFK', country: 'United States', countryCode: 'US', iata: 'JFK' },
  KEWR: { city: 'Newark', country: 'United States', countryCode: 'US', iata: 'EWR' },
  KLGA: { city: 'New York LaGuardia', country: 'United States', countryCode: 'US', iata: 'LGA' },
  KORD: { city: 'Chicago', country: 'United States', countryCode: 'US', iata: 'ORD' },
  KLAX: { city: 'Los Angeles', country: 'United States', countryCode: 'US', iata: 'LAX' },
  KSFO: { city: 'San Francisco', country: 'United States', countryCode: 'US', iata: 'SFO' },
  KATL: { city: 'Atlanta', country: 'United States', countryCode: 'US', iata: 'ATL' },
  KMIA: { city: 'Miami', country: 'United States', countryCode: 'US', iata: 'MIA' },
  KDFW: { city: 'Dallas', country: 'United States', countryCode: 'US', iata: 'DFW' },
  KDEN: { city: 'Denver', country: 'United States', countryCode: 'US', iata: 'DEN' },
  KBOS: { city: 'Boston', country: 'United States', countryCode: 'US', iata: 'BOS' },
  KIAH: { city: 'Houston', country: 'United States', countryCode: 'US', iata: 'IAH' },
  KPHL: { city: 'Philadelphia', country: 'United States', countryCode: 'US', iata: 'PHL' },
  KDTW: { city: 'Detroit', country: 'United States', countryCode: 'US', iata: 'DTW' },
  KMSP: { city: 'Minneapolis', country: 'United States', countryCode: 'US', iata: 'MSP' },
  KSEA: { city: 'Seattle', country: 'United States', countryCode: 'US', iata: 'SEA' },
  KIAD: { city: 'Washington Dulles', country: 'United States', countryCode: 'US', iata: 'IAD' },
  KDCA: { city: 'Washington Reagan', country: 'United States', countryCode: 'US', iata: 'DCA' },
  KFLL: { city: 'Fort Lauderdale', country: 'United States', countryCode: 'US', iata: 'FLL' },
  KMCO: { city: 'Orlando', country: 'United States', countryCode: 'US', iata: 'MCO' },
  KSAN: { city: 'San Diego', country: 'United States', countryCode: 'US', iata: 'SAN' },
  KPHX: { city: 'Phoenix', country: 'United States', countryCode: 'US', iata: 'PHX' },
  KLAS: { city: 'Las Vegas', country: 'United States', countryCode: 'US', iata: 'LAS' },
  KCLT: { city: 'Charlotte', country: 'United States', countryCode: 'US', iata: 'CLT' },
  PANC: { city: 'Anchorage', country: 'United States', countryCode: 'US', iata: 'ANC' },
  PHNL: { city: 'Honolulu', country: 'United States', countryCode: 'US', iata: 'HNL' },
  CYYZ: { city: 'Toronto', country: 'Canada', countryCode: 'CA', iata: 'YYZ' },
  CYUL: { city: 'Montreal', country: 'Canada', countryCode: 'CA', iata: 'YUL' },
  CYVR: { city: 'Vancouver', country: 'Canada', countryCode: 'CA', iata: 'YVR' },
  CYOW: { city: 'Ottawa', country: 'Canada', countryCode: 'CA', iata: 'YOW' },
  CYYC: { city: 'Calgary', country: 'Canada', countryCode: 'CA', iata: 'YYC' },
  CYEG: { city: 'Edmonton', country: 'Canada', countryCode: 'CA', iata: 'YEG' },
  MMMX: { city: 'Mexico City', country: 'Mexico', countryCode: 'MX', iata: 'MEX' },
  MMUN: { city: 'Cancún', country: 'Mexico', countryCode: 'MX', iata: 'CUN' },

  // ── Central America & Caribbean ──────────────────────────────
  MKJP: { city: 'Kingston', country: 'Jamaica', countryCode: 'JM', iata: 'KIN' },
  TNCA: { city: 'Aruba', country: 'Aruba', countryCode: 'AW', iata: 'AUA' },
  TNCC: { city: 'Curaçao', country: 'Curaçao', countryCode: 'CW', iata: 'CUR' },
  TNCB: { city: 'Bonaire', country: 'Bonaire', countryCode: 'BQ', iata: 'BON' },
  TNCM: { city: 'St Maarten', country: 'Sint Maarten', countryCode: 'SX', iata: 'SXM' },
  MDPC: { city: 'Punta Cana', country: 'Dominican Republic', countryCode: 'DO', iata: 'PUJ' },
  MDSD: { city: 'Santo Domingo', country: 'Dominican Republic', countryCode: 'DO', iata: 'SDQ' },
  MUHA: { city: 'Havana', country: 'Cuba', countryCode: 'CU', iata: 'HAV' },
  MROC: { city: 'San José', country: 'Costa Rica', countryCode: 'CR', iata: 'SJO' },
  MPTO: { city: 'Panama City', country: 'Panama', countryCode: 'PA', iata: 'PTY' },

  // ── South America ────────────────────────────────────────────
  SBGR: { city: 'São Paulo', country: 'Brazil', countryCode: 'BR', iata: 'GRU' },
  SBGL: { city: 'Rio de Janeiro', country: 'Brazil', countryCode: 'BR', iata: 'GIG' },
  SAEZ: { city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', iata: 'EZE' },
  SKBO: { city: 'Bogotá', country: 'Colombia', countryCode: 'CO', iata: 'BOG' },
  SPJC: { city: 'Lima', country: 'Peru', countryCode: 'PE', iata: 'LIM' },
  SCEL: { city: 'Santiago', country: 'Chile', countryCode: 'CL', iata: 'SCL' },
  SEQM: { city: 'Quito', country: 'Ecuador', countryCode: 'EC', iata: 'UIO' },
  SVMI: { city: 'Caracas', country: 'Venezuela', countryCode: 'VE', iata: 'CCS' },
  SLLP: { city: 'La Paz', country: 'Bolivia', countryCode: 'BO', iata: 'LPB' },
  SUMU: { city: 'Montevideo', country: 'Uruguay', countryCode: 'UY', iata: 'MVD' },
  SBBE: { city: 'Belém', country: 'Brazil', countryCode: 'BR', iata: 'BEL' },

  // ── Asia ─────────────────────────────────────────────────────
  VHHH: { city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', iata: 'HKG' },
  WSSS: { city: 'Singapore', country: 'Singapore', countryCode: 'SG', iata: 'SIN' },
  VTBS: { city: 'Bangkok', country: 'Thailand', countryCode: 'TH', iata: 'BKK' },
  WIII: { city: 'Jakarta', country: 'Indonesia', countryCode: 'ID', iata: 'CGK' },
  WADD: { city: 'Bali', country: 'Indonesia', countryCode: 'ID', iata: 'DPS' },
  WMKK: { city: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', iata: 'KUL' },
  RPLL: { city: 'Manila', country: 'Philippines', countryCode: 'PH', iata: 'MNL' },
  VVNB: { city: 'Hanoi', country: 'Vietnam', countryCode: 'VN', iata: 'HAN' },
  VVTS: { city: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', iata: 'SGN' },
  VIDP: { city: 'Delhi', country: 'India', countryCode: 'IN', iata: 'DEL' },
  VABB: { city: 'Mumbai', country: 'India', countryCode: 'IN', iata: 'BOM' },
  VOBL: { city: 'Bangalore', country: 'India', countryCode: 'IN', iata: 'BLR' },
  VECC: { city: 'Kolkata', country: 'India', countryCode: 'IN', iata: 'CCU' },
  VOMM: { city: 'Chennai', country: 'India', countryCode: 'IN', iata: 'MAA' },
  VCBI: { city: 'Colombo', country: 'Sri Lanka', countryCode: 'LK', iata: 'CMB' },
  VRMM: { city: 'Malé', country: 'Maldives', countryCode: 'MV', iata: 'MLE' },
  OPKC: { city: 'Karachi', country: 'Pakistan', countryCode: 'PK', iata: 'KHI' },
  OPRN: { city: 'Islamabad', country: 'Pakistan', countryCode: 'PK', iata: 'ISB' },
  OPLA: { city: 'Lahore', country: 'Pakistan', countryCode: 'PK', iata: 'LHE' },
  VYYY: { city: 'Yangon', country: 'Myanmar', countryCode: 'MM', iata: 'RGN' },
  VTCC: { city: 'Chiang Mai', country: 'Thailand', countryCode: 'TH', iata: 'CNX' },

  // ── East Asia ────────────────────────────────────────────────
  RJTT: { city: 'Tokyo Haneda', country: 'Japan', countryCode: 'JP', iata: 'HND' },
  RJAA: { city: 'Tokyo Narita', country: 'Japan', countryCode: 'JP', iata: 'NRT' },
  RJBB: { city: 'Osaka Kansai', country: 'Japan', countryCode: 'JP', iata: 'KIX' },
  RJFF: { city: 'Fukuoka', country: 'Japan', countryCode: 'JP', iata: 'FUK' },
  RJCC: { city: 'Sapporo', country: 'Japan', countryCode: 'JP', iata: 'CTS' },
  RKSI: { city: 'Seoul Incheon', country: 'South Korea', countryCode: 'KR', iata: 'ICN' },
  RKSS: { city: 'Seoul Gimpo', country: 'South Korea', countryCode: 'KR', iata: 'GMP' },
  ZBAA: { city: 'Beijing', country: 'China', countryCode: 'CN', iata: 'PEK' },
  ZSPD: { city: 'Shanghai Pudong', country: 'China', countryCode: 'CN', iata: 'PVG' },
  ZSSS: { city: 'Shanghai Hongqiao', country: 'China', countryCode: 'CN', iata: 'SHA' },
  ZGGG: { city: 'Guangzhou', country: 'China', countryCode: 'CN', iata: 'CAN' },
  ZGSZ: { city: 'Shenzhen', country: 'China', countryCode: 'CN', iata: 'SZX' },
  ZUUU: { city: 'Chengdu', country: 'China', countryCode: 'CN', iata: 'CTU' },
  VGHS: { city: 'Dhaka', country: 'Bangladesh', countryCode: 'BD', iata: 'DAC' },
  RCTP: { city: 'Taipei', country: 'Taiwan', countryCode: 'TW', iata: 'TPE' },
  VMMC: { city: 'Macau', country: 'Macau', countryCode: 'MO', iata: 'MFM' },

  // ── Russia & Central Asia ────────────────────────────────────
  UUEE: { city: 'Moscow Sheremetyevo', country: 'Russia', countryCode: 'RU', iata: 'SVO' },
  UUDD: { city: 'Moscow Domodedovo', country: 'Russia', countryCode: 'RU', iata: 'DME' },
  ULLI: { city: 'St Petersburg', country: 'Russia', countryCode: 'RU', iata: 'LED' },
  UAAA: { city: 'Almaty', country: 'Kazakhstan', countryCode: 'KZ', iata: 'ALA' },
  UACC: { city: 'Astana', country: 'Kazakhstan', countryCode: 'KZ', iata: 'TSE' },
  UTTT: { city: 'Tashkent', country: 'Uzbekistan', countryCode: 'UZ', iata: 'TAS' },
  UGTB: { city: 'Tbilisi', country: 'Georgia', countryCode: 'GE', iata: 'TBS' },
  UBBB: { city: 'Baku', country: 'Azerbaijan', countryCode: 'AZ', iata: 'GYD' },
  UDYZ: { city: 'Yerevan', country: 'Armenia', countryCode: 'AM', iata: 'EVN' },

  // ── Oceania ──────────────────────────────────────────────────
  YSSY: { city: 'Sydney', country: 'Australia', countryCode: 'AU', iata: 'SYD' },
  YMML: { city: 'Melbourne', country: 'Australia', countryCode: 'AU', iata: 'MEL' },
  YBBN: { city: 'Brisbane', country: 'Australia', countryCode: 'AU', iata: 'BNE' },
  YPAD: { city: 'Adelaide', country: 'Australia', countryCode: 'AU', iata: 'ADL' },
  YPPH: { city: 'Perth', country: 'Australia', countryCode: 'AU', iata: 'PER' },
  NZAA: { city: 'Auckland', country: 'New Zealand', countryCode: 'NZ', iata: 'AKL' },
  NZWN: { city: 'Wellington', country: 'New Zealand', countryCode: 'NZ', iata: 'WLG' },
  NZCH: { city: 'Christchurch', country: 'New Zealand', countryCode: 'NZ', iata: 'CHC' },

  // ── Additional European ──────────────────────────────────────
  LSZA: { city: 'Lugano', country: 'Switzerland', countryCode: 'CH', iata: 'LUG' },
  LWSK: { city: 'Skopje', country: 'North Macedonia', countryCode: 'MK', iata: 'SKP' },
  LAAD: { city: 'Tirana', country: 'Albania', countryCode: 'AL', iata: 'TIA' },
  LATI: { city: 'Tirana', country: 'Albania', countryCode: 'AL', iata: 'TIA' },
  BKPR: { city: 'Pristina', country: 'Kosovo', countryCode: 'XK', iata: 'PRN' },
  LQSA: { city: 'Sarajevo', country: 'Bosnia and Herzegovina', countryCode: 'BA', iata: 'SJJ' },
  LYPG: { city: 'Podgorica', country: 'Montenegro', countryCode: 'ME', iata: 'TGD' },
};

let iataToIcaoCache: Map<string, string> | undefined;

/** Resolve ICAO from IATA when the airport exists in {@link AIRPORTS}. */
export function resolveIcaoFromIata(iata: string): string | undefined {
  if (!iataToIcaoCache) {
    iataToIcaoCache = new Map();
    for (const [icao, info] of Object.entries(AIRPORTS)) {
      if (info.iata) {
        iataToIcaoCache.set(info.iata.toUpperCase(), icao);
      }
    }
  }
  return iataToIcaoCache.get(iata.toUpperCase());
}
