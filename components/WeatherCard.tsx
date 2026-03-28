'use client';

import type { MetarData, FlightCategory, CloudLayer } from '@/lib/api/weather';

interface WeatherCardProps {
  weather: MetarData | null | undefined;
}

// ---------------------------------------------------------------------------
// Weather phenomena parsing from raw METAR
// ---------------------------------------------------------------------------

type WeatherCondition =
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

function deriveCondition(weather: MetarData): WeatherCondition {
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

function conditionIcon(cond: WeatherCondition): string {
  switch (cond) {
    case 'thunderstorm':
      return '\u26C8\uFE0F';
    case 'heavy-rain':
      return '\uD83C\uDF27\uFE0F';
    case 'rain':
      return '\uD83C\uDF26\uFE0F';
    case 'drizzle':
      return '\uD83C\uDF26\uFE0F';
    case 'snow':
      return '\u2744\uFE0F';
    case 'sleet':
      return '\uD83C\uDF28\uFE0F';
    case 'fog':
      return '\uD83C\uDF2B\uFE0F';
    case 'mist':
      return '\uD83C\uDF2B\uFE0F';
    case 'haze':
      return '\uD83C\uDF24\uFE0F';
    case 'overcast':
      return '\u2601\uFE0F';
    case 'mostly-cloudy':
      return '\uD83C\uDF25\uFE0F';
    case 'partly-cloudy':
      return '\u26C5';
    case 'few-clouds':
      return '\uD83C\uDF24\uFE0F';
    case 'clear':
      return '\u2600\uFE0F';
  }
}

function conditionLabel(cond: WeatherCondition): string {
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

function flightCategoryStyle(cat: FlightCategory): { bg: string; text: string; dot: string } {
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

function flightCategoryLabel(cat: FlightCategory): string {
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

function windDirectionName(deg: number | null): string {
  if (deg === null) return 'Variable';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

function windDescription(weather: MetarData): string {
  const spd = weather.windSpeed ?? 0;
  if (spd === 0) return 'Calm';
  if (spd <= 5) return 'Light';
  if (spd <= 15) return 'Moderate';
  if (spd <= 25) return 'Strong';
  return 'Very Strong';
}

/** CSS transform rotation: METAR wind direction is "from", arrow should point downwind */
function windArrowRotation(deg: number | null): string {
  if (deg === null) return 'rotate(0deg)';
  return `rotate(${deg + 180}deg)`;
}

// ---------------------------------------------------------------------------
// Visibility helpers
// ---------------------------------------------------------------------------

function visibilityDescriptor(vis: number | null): string {
  if (vis === null) return 'Unknown';
  if (vis >= 6) return 'Unrestricted';
  if (vis >= 3) return 'Good';
  if (vis >= 1) return 'Reduced';
  return 'Very Low';
}

// ---------------------------------------------------------------------------
// Cloud cover bar
// ---------------------------------------------------------------------------

function cloudCoverPercent(cover: string): number {
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

function cloudCoverLabel(cover: string): string {
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

function buildSummary(weather: MetarData, condition: WeatherCondition): string {
  const parts: string[] = [];
  parts.push(conditionLabel(condition));
  if (weather.temp !== null) parts.push(`${weather.temp}\u00B0C`);
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

function formatAge(fetchedAt: number, obsTime: number): string {
  const ageMin = Math.round((fetchedAt - obsTime) / 60_000);
  if (ageMin < 1) return 'just now';
  if (ageMin === 1) return '1 min ago';
  return `${ageMin} min ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CloudLayerBar({ layer }: { layer: CloudLayer }) {
  const pct = cloudCoverPercent(layer.cover);
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-medium text-muted-foreground w-16 shrink-0">
        {layer.base.toLocaleString()} ft
      </span>
      <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-400/70 dark:bg-sky-500/50 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{cloudCoverLabel(layer.cover)}</span>
    </div>
  );
}

function WindCompass({ direction, speed, gust }: { direction: number | null; speed: number | null; gust: number | null }) {
  const spd = speed ?? 0;
  return (
    <div className="flex items-center gap-3">
      {/* Compass ring */}
      <div className="relative w-12 h-12 shrink-0">
        <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20" />
        {/* Cardinal tick marks */}
        <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 text-[8px] font-bold text-muted-foreground">
          N
        </span>
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0.5 text-[8px] font-bold text-muted-foreground">
          S
        </span>
        <span className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 text-[8px] font-bold text-muted-foreground">
          W
        </span>
        <span className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1 text-[8px] font-bold text-muted-foreground">
          E
        </span>
        {/* Wind arrow */}
        {direction !== null && (
          <div
            className="absolute inset-1 flex items-center justify-center"
            style={{ transform: windArrowRotation(direction) }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-sky-500 dark:text-sky-400" fill="currentColor">
              <path d="M12 2L8 10h3v12h2V10h3L12 2z" />
            </svg>
          </div>
        )}
        {direction === null && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
            VRB
          </div>
        )}
      </div>
      {/* Wind values */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold tabular-nums">{spd}</span>
          <span className="text-xs text-muted-foreground font-medium">kt</span>
        </div>
        {gust != null && gust > spd && (
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              G{gust}
            </span>
            <span className="text-xs text-muted-foreground">kt</span>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {direction !== null ? `${direction}\u00B0 (${windDirectionName(direction)})` : 'Variable'}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WeatherCard({ weather }: WeatherCardProps) {
  if (!weather) {
    return (
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Current Weather
          </h2>
        </div>
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <span className="animate-pulse">Loading weather data...</span>
        </div>
      </div>
    );
  }

  const condition = deriveCondition(weather);
  const catStyle = flightCategoryStyle(weather.flightCategory);
  const summary = buildSummary(weather, condition);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-auto max-h-[700px] flex flex-col">
      {/* ---- Header: condition + temp + flight category ---- */}
      <div className="px-5 pt-5 pb-4">
        {/* Top row: title + flight category badge */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            EHAM Weather
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${catStyle.bg} ${catStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${catStyle.dot}`} />
            {weather.flightCategory}
          </span>
        </div>

        {/* Big condition display */}
        <div className="flex items-center gap-4 mb-2">
          <span className="text-5xl leading-none" role="img" aria-label={conditionLabel(condition)}>
            {conditionIcon(condition)}
          </span>
          <div className="flex flex-col">
            <span className="text-4xl font-bold tabular-nums tracking-tight leading-none">
              {weather.temp !== null ? `${weather.temp}\u00B0` : '--'}
            </span>
            {weather.dewpoint !== null && (
              <span className="text-xs text-muted-foreground mt-1">
                Dew point {weather.dewpoint}\u00B0C
              </span>
            )}
          </div>
        </div>

        {/* Condition label */}
        <p className="text-sm font-medium">{conditionLabel(condition)}</p>

        {/* Flight category expanded label */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {flightCategoryLabel(weather.flightCategory)}
        </p>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t" />

      {/* ---- Data grid ---- */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* Wind */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Wind
          </p>
          <WindCompass
            direction={weather.windDirection}
            speed={weather.windSpeed}
            gust={weather.windGust}
          />
        </div>

        {/* Visibility + QNH row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Visibility
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight">
              {weather.visibility !== null ? (
                <>
                  {weather.visibility >= 6 ? '6+' : weather.visibility}
                  <span className="text-xs font-medium text-muted-foreground ml-1">SM</span>
                </>
              ) : (
                '--'
              )}
            </p>
            <p className="text-xs text-muted-foreground">{visibilityDescriptor(weather.visibility)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
              Pressure
            </p>
            <p className="text-lg font-bold tabular-nums leading-tight">
              {weather.qnh !== null ? (
                <>
                  {weather.qnh}
                  <span className="text-xs font-medium text-muted-foreground ml-1">hPa</span>
                </>
              ) : (
                '--'
              )}
            </p>
            <p className="text-xs text-muted-foreground">QNH</p>
          </div>
        </div>

        {/* Ceiling / Clouds */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            {weather.ceiling !== null ? 'Ceiling' : 'Cloud Layers'}
          </p>
          {weather.ceiling !== null && (
            <p className="text-lg font-bold tabular-nums leading-tight mb-1">
              {weather.ceiling.toLocaleString()}
              <span className="text-xs font-medium text-muted-foreground ml-1">ft AGL</span>
            </p>
          )}
          {weather.clouds.length > 0 ? (
            <div className="space-y-1.5">
              {weather.clouds.map((layer, i) => (
                <CloudLayerBar key={i} layer={layer} />
              ))}
            </div>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Clear skies</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t" />

      {/* ---- Summary + METAR footer ---- */}
      <div className="px-5 py-3 space-y-2">
        {/* Natural language summary */}
        <p className="text-xs text-muted-foreground leading-relaxed italic">
          {summary}
        </p>

        {/* Raw METAR */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Raw METAR
          </p>
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
              {weather.raw}
            </p>
          </div>
        </div>

        {/* Observation age */}
        <p className="text-[10px] text-muted-foreground text-right">
          Observed {formatAge(weather.fetchedAt, weather.observationTime)}
        </p>
      </div>
    </div>
  );
}
