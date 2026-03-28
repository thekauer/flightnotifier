import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

interface AirportCellProps {
  /** ICAO airport code, e.g. "EHAM" */
  icaoCode?: string;
  className?: string;
}

/**
 * Renders an airport as a table cell: flag emoji + city name.
 * Hovering over the flag shows the full country name.
 * Falls back to the raw ICAO code if unknown, or "—" if no code provided.
 */
export function AirportCell({ icaoCode, className }: AirportCellProps) {
  if (!icaoCode) {
    return (
      <td className={`px-3 py-1.5 text-muted-foreground ${className ?? ''}`.trim()}>
        —
      </td>
    );
  }

  const info = getAirportInfo(icaoCode);

  if (!info) {
    return (
      <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>
        <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
          {icaoCode}
        </span>
      </td>
    );
  }

  const flag = countryCodeToFlag(info.countryCode);

  const badge = info.iata ?? icaoCode;

  return (
    <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>
      <span className="whitespace-nowrap">
        <span title={info.country} className="cursor-default">{flag}</span>
        {' '}
        <span title={info.city} className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground cursor-default">
          {badge}
        </span>
      </span>
    </td>
  );
}
