/**
 * IATA → ICAO airline code mapping.
 *
 * Covers airlines that serve Amsterdam Schiphol (AMS) plus major global
 * carriers.  Used to match OpenSky ADS-B callsign prefixes (ICAO codes)
 * against Flighty arrival board entries (IATA codes).
 */

const IATA_TO_ICAO = new Map<string, string>([
  // --- Home carrier & alliances at AMS ---
  ['KL', 'KLM'],  // KLM Royal Dutch Airlines
  ['HV', 'TRA'],  // Transavia
  ['WA', 'KLC'],  // KLM Cityhopper
  ['OR', 'TFL'],  // TUI fly Netherlands

  // --- SkyTeam ---
  ['AF', 'AFR'],  // Air France
  ['AZ', 'ITY'],  // ITA Airways (formerly Alitalia)
  ['SU', 'AFL'],  // Aeroflot
  ['MU', 'CES'],  // China Eastern Airlines
  ['CZ', 'CSN'],  // China Southern Airlines
  ['CI', 'CAL'],  // China Airlines
  ['KE', 'KAL'],  // Korean Air
  ['DL', 'DAL'],  // Delta Air Lines
  ['OK', 'CSA'],  // Czech Airlines
  ['ME', 'MEA'],  // Middle East Airlines
  ['RO', 'ROT'],  // TAROM
  ['VN', 'HVN'],  // Vietnam Airlines
  ['AR', 'ARG'],  // Aerolíneas Argentinas
  ['SV', 'SVA'],  // Saudia
  ['GA', 'GIA'],  // Garuda Indonesia
  ['XL', 'LNE'],  // LATAM Airlines Ecuador

  // --- Star Alliance ---
  ['LH', 'DLH'],  // Lufthansa
  ['LX', 'SWR'],  // SWISS
  ['OS', 'AUA'],  // Austrian Airlines
  ['SN', 'BEL'],  // Brussels Airlines
  ['SK', 'SAS'],  // SAS Scandinavian Airlines
  ['UA', 'UAL'],  // United Airlines
  ['AC', 'ACA'],  // Air Canada
  ['NH', 'ANA'],  // ANA (All Nippon Airways)
  ['TG', 'THA'],  // Thai Airways
  ['SQ', 'SIA'],  // Singapore Airlines
  ['TK', 'THY'],  // Turkish Airlines
  ['ET', 'ETH'],  // Ethiopian Airlines
  ['SA', 'SAA'],  // South African Airways
  ['TP', 'TAP'],  // TAP Air Portugal
  ['MS', 'MSR'],  // EgyptAir
  ['CA', 'CCA'],  // Air China
  ['AI', 'AIC'],  // Air India
  ['LO', 'LOT'],  // LOT Polish Airlines
  ['OU', 'CTN'],  // Croatia Airlines
  ['A3', 'AEE'],  // Aegean Airlines
  ['OZ', 'AAR'],  // Asiana Airlines
  ['CM', 'CMP'],  // Copa Airlines
  ['AV', 'AVA'],  // Avianca
  ['NZ', 'ANZ'],  // Air New Zealand
  ['BR', 'EVA'],  // EVA Air
  ['EN', 'DLA'],  // Air Dolomiti

  // --- oneworld ---
  ['BA', 'BAW'],  // British Airways
  ['AA', 'AAL'],  // American Airlines
  ['IB', 'IBE'],  // Iberia
  ['AY', 'FIN'],  // Finnair
  ['CX', 'CPA'],  // Cathay Pacific
  ['QF', 'QFA'],  // Qantas
  ['QR', 'QAT'],  // Qatar Airways
  ['JL', 'JAL'],  // Japan Airlines
  ['MH', 'MAS'],  // Malaysia Airlines
  ['RJ', 'RJA'],  // Royal Jordanian
  ['S7', 'SBI'],  // S7 Airlines
  ['UL', 'ALK'],  // SriLankan Airlines
  ['AT', 'RAM'],  // Royal Air Maroc
  ['FJ', 'FJI'],  // Fiji Airways

  // --- Major low-cost carriers ---
  ['FR', 'RYR'],  // Ryanair
  ['U2', 'EZY'],  // easyJet
  ['W6', 'WZZ'],  // Wizz Air
  ['VY', 'VLG'],  // Vueling
  ['DY', 'NAX'],  // Norwegian Air Shuttle
  ['D8', 'IBK'],  // Norwegian Air International (long-haul tag)
  ['PC', 'PGT'],  // Pegasus Airlines
  ['LS', 'EXS'],  // Jet2.com
  ['BE', 'BEE'],  // Flybe
  ['W9', 'WZZ'],  // Wizz Air UK (same ICAO family)
  ['TO', 'TVF'],  // Transavia France
  ['QS', 'TVS'],  // SmartWings
  ['6E', 'IGO'],  // IndiGo
  ['G3', 'GLO'],  // GOL Linhas Aéreas
  ['NK', 'NKS'],  // Spirit Airlines
  ['F9', 'FFT'],  // Frontier Airlines
  ['WN', 'SWA'],  // Southwest Airlines
  ['B6', 'JBU'],  // JetBlue Airways

  // --- Gulf / Middle-East ---
  ['EK', 'UAE'],  // Emirates
  ['EY', 'ETD'],  // Etihad Airways
  ['GF', 'GFA'],  // Gulf Air
  ['WY', 'OMA'],  // Oman Air
  ['KU', 'KAC'],  // Kuwait Airways
  ['G9', 'ABY'],  // Air Arabia
  ['FZ', 'FDB'],  // flydubai
  ['J9', 'JZR'],  // Jazeera Airways

  // --- Africa ---
  ['WB', 'RWD'],  // RwandAir
  ['TC', 'ATC'],  // Air Tanzania
  ['KQ', 'KQA'],  // Kenya Airways

  // --- Americas ---
  ['AM', 'AMX'],  // Aeroméxico
  ['LA', 'LAN'],  // LATAM Airlines
  ['JJ', 'TAM'],  // LATAM Brasil
  ['PA', 'AAP'],  // Airblue
  ['AS', 'ASA'],  // Alaska Airlines
  ['HA', 'HAL'],  // Hawaiian Airlines
  ['WS', 'WJA'],  // WestJet
  ['TS', 'TSC'],  // Air Transat

  // --- Asia-Pacific ---
  ['CZ', 'CSN'],  // China Southern Airlines (duplicate – kept for clarity)
  ['HU', 'CHH'],  // Hainan Airlines
  ['3U', 'CSC'],  // Sichuan Airlines
  ['MF', 'CXA'],  // Xiamen Airlines
  ['OD', 'BTV'],  // Batik Air (Malaysia)
  ['PR', 'PAL'],  // Philippine Airlines
  ['BI', 'RBA'],  // Royal Brunei Airlines
  ['PG', 'BKP'],  // Bangkok Airways
  ['VJ', 'VJC'],  // VietJet Air
  ['QZ', 'AWQ'],  // Indonesia AirAsia
  ['AK', 'AXM'],  // AirAsia
  ['KA', 'HDA'],  // Cathay Dragon (HK Express rebrand pending)
  ['5J', 'CEB'],  // Cebu Pacific

  // --- Europe (additional) ---
  ['EI', 'EIN'],  // Aer Lingus
  ['BT', 'BTI'],  // airBaltic
  ['FB', 'LZB'],  // Bulgaria Air
  ['JU', 'ASL'],  // Air Serbia
  ['PS', 'AUI'],  // Ukraine International Airlines
  ['OA', 'OAL'],  // Olympic Air
  ['BJ', 'LBT'],  // Nouvelair
  ['YM', 'MGX'],  // Montenegro Airlines
  ['W2', 'FLE'],  // FlexFlight
  ['RC', 'FLI'],  // Atlantic Airways
  ['FI', 'ICE'],  // Icelandair
  ['GL', 'GRL'],  // Air Greenland
  ['AH', 'DAH'],  // Air Algérie
  ['TU', 'TAR'],  // Tunisair
  ['DE', 'CFG'],  // Condor
  ['X3', 'HLX'],  // TUIfly (Germany)
  ['EW', 'EWG'],  // Eurowings
  ['4U', 'GWI'],  // Germanwings (now Eurowings)
  ['XQ', 'SXS'],  // SunExpress

  // --- Cargo (sometimes visible in ADS-B near AMS) ---
  ['MP', 'MPH'],  // Martinair Cargo
  ['CV', 'CLX'],  // Cargolux
  ['FX', 'FDX'],  // FedEx Express
  ['5X', 'UPS'],  // UPS Airlines
  ['QY', 'BCS'],  // European Air Transport (DHL)
]);

/** Reverse mapping: ICAO → IATA. Built lazily on first access. */
let icaoToIataMap: Map<string, string> | null = null;

function getIcaoToIataMap(): Map<string, string> {
  if (!icaoToIataMap) {
    icaoToIataMap = new Map<string, string>();
    for (const [iata, icao] of IATA_TO_ICAO) {
      // First writer wins (avoids duplicate-ICAO edge cases like W9/W6 → WZZ)
      if (!icaoToIataMap.has(icao)) {
        icaoToIataMap.set(icao, iata);
      }
    }
  }
  return icaoToIataMap;
}

/**
 * Look up the ICAO airline code for a given IATA code.
 * Returns `null` when the IATA code is not in the map.
 */
export function resolveAirlineIcao(iata: string): string | null {
  return IATA_TO_ICAO.get(iata.toUpperCase()) ?? null;
}

/**
 * Look up the IATA airline code for a given ICAO code.
 * Returns `null` when the ICAO code is not in the map.
 */
export function resolveAirlineIata(icao: string): string | null {
  return getIcaoToIataMap().get(icao.toUpperCase()) ?? null;
}

export { IATA_TO_ICAO };
