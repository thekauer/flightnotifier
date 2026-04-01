'use client';

import type { MetarData } from '@/lib/api/weather';
import { DEGREE_SIGN } from '@/lib/constants/icons';
import {
  deriveCondition,
  conditionIcon,
  conditionLabel,
  flightCategoryStyle,
  flightCategoryLabel,
  visibilityDescriptor,
  buildSummary,
  formatAge,
} from './weatherHelpers';
import { CloudLayerBar } from './CloudLayerBar';
import { WindCompass } from './WindCompass';

interface WeatherCardProps {
  weather: MetarData | null | undefined;
}

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
              {weather.temp !== null ? `${weather.temp}${DEGREE_SIGN}` : '--'}
            </span>
            {weather.dewpoint !== null && (
              <span className="text-xs text-muted-foreground mt-1">
                Dew point {weather.dewpoint}{DEGREE_SIGN}C
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
