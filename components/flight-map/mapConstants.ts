// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
export const COLOR_DEFAULT = '#ca8a04'; // muted yellow — normal flights
export const COLOR_APPROACHING = '#16a34a'; // green — flights in approach cone
export const COLOR_IN_ZONE = '#3b82f6'; // blue — aircraft inside notification zone
export const COLOR_SELECTED = '#f97316'; // orange — selected aircraft
export const COLOR_CONE = '#16a34a'; // green — approach cone overlay
export const COLOR_RUNWAY_FILL_LIGHT = '#333';
export const COLOR_RUNWAY_FILL_DARK = '#71717a';
export const COLOR_RUNWAY_STROKE_LIGHT = '#555';
export const COLOR_RUNWAY_STROKE_DARK = '#a1a1aa';
export const COLOR_ZONE_BORDER = '#3b82f6'; // blue — notification zone rectangle

/** Tile URLs for light and dark themes (CartoDB free tiles). */
export const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
export const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const SCHIPHOL_POS: [number, number] = [52.3105, 4.7683];

/**
 * EHAM runway data from OurAirports.
 * Each runway is defined by low-end (LE) and high-end (HE) coordinates plus width in feet.
 */
export const EHAM_RUNWAYS: {
  le: [number, number]; // [lat, lon]
  he: [number, number];
  widthFt: number;
  leIdent: string;
  heIdent: string;
}[] = [
  { le: [52.3004, 4.78348], he: [52.314, 4.80302], widthFt: 148, leIdent: '04', heIdent: '22' },
  { le: [52.2879, 4.73402], he: [52.3046, 4.77752], widthFt: 148, leIdent: '06', heIdent: '24' },
  { le: [52.3166, 4.74635], he: [52.3184, 4.79689], widthFt: 148, leIdent: '09', heIdent: '27' },
  { le: [52.3314, 4.74003], he: [52.3018, 4.7375], widthFt: 148, leIdent: '18C', heIdent: '36C' },
  { le: [52.3213, 4.77996], he: [52.2908, 4.77735], widthFt: 148, leIdent: '18L', heIdent: '36R' },
  { le: [52.3627, 4.71193], he: [52.3286, 4.70884], widthFt: 198, leIdent: '18R', heIdent: '36L' },
];

/** Convert feet to meters. */
export const FT_TO_M = 0.3048;

/** Metres per degree of latitude (roughly constant). */
export const M_PER_DEG_LAT = 111_320;

/** Visual width multiplier — real runways are too thin to see clearly on the map. */
export const RUNWAY_WIDTH_SCALE = 4;

export const SCHIPHOL_LAT = 52.3105;
export const SCHIPHOL_LON = 4.7683;
