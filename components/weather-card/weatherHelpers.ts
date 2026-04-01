import type { MetarData, FlightCategory } from '@/lib/api/weather';
import {
  THUNDERSTORM_ICON,
  HEAVY_RAIN_ICON,
  RAIN_ICON,
  SNOW_ICON,
  SLEET_ICON,
  FOG_ICON,
  HAZE_ICON,
  OVERCAST_ICON,
  MOSTLY_CLOUDY_ICON,
  PARTLY_CLOUDY_ICON,
  FEW_CLOUDS_ICON,
  CLEAR_SKY_ICON,
  DEGREE_SIGN,
} from '@/lib/constants/icons';

export type { FlightCategory } from '@/lib/api/weather';

// ---------------------------------------------------------------------------
// Weather phenomena parsing from raw METAR
// ---------------------------------------------------------------------------

export type WeatherCondition =
  | 'thunderstorm'
  | 'heavy-rain'
  | 'rain'
  | 'drizzle'
  | 'snow'
  | 'sleet'
  | 'fog'
  | 'mist'
  | 'haze'
  | 'overcast'
  | 'mostly-cloudy'
  | 'partly-cloudy'
  | 'few-clouds'
  | 'clear';

export function deriveCondition(weather: MetarData): WeatherCondition {
  const raw = weather.raw.toUpperCase();

  // Check for significant weather phenomena in the METAR
  if (raw.includes(' TS') || raw.includes('+TS')) return 'thunderstorm';
  if (raw.includes('+RA') || raw.includes('+SHRA')) return 'heavy-rain';
  if (raw.includes(' RA') || raw.includes(' SHRA') || raw.includes('-RA') || raw.includes('-SHRA'))
    return 'rain';
  if (raw.includes(' DZ') || raw.includes('-DZ')) return 'drizzle';
  if (raw.includes(' SN') || raw.includes('+SN') || raw.includes('-SN') || raw.includes(' SHSN'))
    return 'snow';
  if (raw.includes(' FZRA') || raw.includes(' PL') || raw.includes(' GS')) return 'sleet';
  if (raw.includes(' FG')) return 'fog';
  if (raw.includes(' BR')) return 'mist';
  if (raw.includes(' HZ')) return 'haze';

  // Fall back to cloud cover
  const covers = weather.clouds.map((c) => c.cover);
  if (covers.includes('OVC')) return 'overcast';
  if (covers.includes('BKN')) return 'mostly-cloudy';
  if (covers.includes('SCT')) return 'partly-cloudy';
  if (covers.includes('FEW')) return 'few-clouds';

  return 'clear';
}

export function conditionIcon(cond: WeatherCondition): string {
  switch (cond) {
    case 'thunderstorm':
      return THUNDERSTORM_ICON;
    case 'heavy-rain':
      return HEAVY_RAIN_ICON;
    case 'rain':
      return RAIN_ICON;
    case 'drizzle':
      return RAIN_ICON;
    case 'snow':
      return SNOW_ICON;
    case 'sleet':
      return SLEET_ICON;
    case 'fog':
      return FOG_ICON;
    case 'mist':
      return FOG_ICON;
    case 'haze':
      return HAZE_ICON;
    case 'overcast':
      return OVERCAST_ICON;
    case 'mostly-cloudy':
      return MOSTLY_CLOUDY_ICON;
    case 'partly-cloudy':
      return PARTLY_CLOUDY_ICON;
    case 'few-clouds':
      return FEW_CLOUDS_ICON;
    case 'clear':
      return CLEAR_SKY_ICON;
  }
}

export function conditionLabel(cond: WeatherCondition): string {
  switch (cond) {
    case 'thunderstorm':
      return 'Thunderstorm';
    case 'heavy-rain':
      return 'Heavy Rain';
    case 'rain':
      return 'Rain';
    case 'drizzle':
      return 'Drizzle';
    case 'snow':
      return 'Snow';
    case 'sleet':
      return 'Freezing Rain / Sleet';
    case 'fog':
      return 'Fog';
    case 'mist':
      return 'Mist';
    case 'haze':
      return 'Haze';
    case 'overcast':
      return 'Overcast';
    case 'mostly-cloudy':
      return 'Mostly Cloudy';
    case 'partly-cloudy':
      return 'Partly Cloudy';
    case 'few-clouds':
      return 'Mostly Clear';
    case 'clear':
      return 'Clear Skies';
  }
}

// ---------------------------------------------------------------------------
// Flight category
// ---------------------------------------------------------------------------

export function flightCategoryStyle(cat: FlightCategory): { bg: string; text: string; dot: string } {
  switch (cat) {
    case 'VFR':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    case 'MVFR':
      return { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' };
    case 'IFR':
      return { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' };
    case 'LIFR':
      return { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' };
  }
}

export function flightCategoryLabel(cat: FlightCategory): string {
  switch (cat) {
    case 'VFR':
      return 'Visual Flight Rules';
    case 'MVFR':
      return 'Marginal VFR';
    case 'IFR':
      return 'Instrument Flight Rules';
    case 'LIFR':
      return 'Low IFR';
  }
}

// ---------------------------------------------------------------------------
// Wind helpers
// ---------------------------------------------------------------------------

export function windDirectionName(deg: number | null): string {
  if (deg === null) return 'Variable';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

export function windDescription(weather: MetarData): string {
  const spd = weather.windSpeed ?? 0;
  if (spd === 0) return 'Calm';
  if (spd <= 5) return 'Light';
  if (spd <= 15) return 'Moderate';
  if (spd <= 25) return 'Strong';
  return 'Very Strong';
}

/** CSS transform rotation: METAR wind direction is "from", arrow should point downwind */
export function windArrowRotation(deg: number | null): string {
  if (deg === null) return 'rotate(0deg)';
  return `rotate(${deg + 180}deg)`;
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

export function visibilityDescriptor(vis: number | null): string {
  if (vis === null) return 'Unknown';
  if (vis >= 6) return 'Unrestricted';
  if (vis >= 3) return 'Good';
  if (vis >= 1) return 'Reduced';
  return 'Very Low';
}

// ---------------------------------------------------------------------------
// Cloud cover helpers
// ---------------------------------------------------------------------------

export function cloudCoverPercent(cover: string): number {
  switch (cover) {
    case 'FEW':
      return 25;
    case 'SCT':
      return 50;
    case 'BKN':
      return 75;
    case 'OVC':
      return 100;
    default:
      return 0;
  }
}

export function cloudCoverLabel(cover: string): string {
  switch (cover) {
    case 'SKC':
    case 'CLR':
      return 'Clear';
    case 'FEW':
      return 'Few';
    case 'SCT':
      return 'Scattered';
    case 'BKN':
      return 'Broken';
    case 'OVC':
      return 'Overcast';
    default:
      return cover;
  }
}

// ---------------------------------------------------------------------------
// Summary text
// ---------------------------------------------------------------------------

export function buildSummary(weather: MetarData, condition: WeatherCondition): string {
  const parts: string[] = [];
  parts.push(conditionLabel(condition));
  if (weather.temp !== null) parts.push(`${weather.temp}${DEGREE_SIGN}C`);
  const spd = weather.windSpeed ?? 0;
  if (spd === 0) {
    parts.push('Calm winds');
  } else {
    const dir = windDirectionName(weather.windDirection);
    parts.push(`${windDescription(weather)} winds from the ${dir}`);
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

export function formatAge(fetchedAt: number, obsTime: number): string {
  const ageMin = Math.round((fetchedAt - obsTime) / 60_000);
  if (ageMin < 1) return 'just now';
  if (ageMin === 1) return '1 min ago';
  return `${ageMin} min ago`;
}
