'use client';

import NumberFlow from '@number-flow/react';
import { VsCell } from './VsCell';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirlineLogoUrl } from '@/lib/airlineLogo';

const COUNTRY_CODES: Record<string, string> = {
  'Kingdom of the Netherlands': 'NL',
  'Netherlands': 'NL',
  'Germany': 'DE',
  'France': 'FR',
  'United Kingdom': 'GB',
  'United States': 'US',
  'Spain': 'ES',
  'Italy': 'IT',
  'Belgium': 'BE',
  'Switzerland': 'CH',
  'Turkey': 'TR',
  'Norway': 'NO',
  'Sweden': 'SE',
  'Denmark': 'DK',
  'Ireland': 'IE',
  'Portugal': 'PT',
  'Austria': 'AT',
  'Poland': 'PL',
  'Greece': 'GR',
  'Finland': 'FI',
  'Czech Republic': 'CZ',
  'Czechia': 'CZ',
  'Romania': 'RO',
  'Hungary': 'HU',
  'Luxembourg': 'LU',
  'Iceland': 'IS',
  'Canada': 'CA',
  'China': 'CN',
  'Japan': 'JP',
  'South Korea': 'KR',
  'Australia': 'AU',
  'Brazil': 'BR',
  'India': 'IN',
  'Russia': 'RU',
  'Saudi Arabia': 'SA',
  'United Arab Emirates': 'AE',
  'Israel': 'IL',
  'Mexico': 'MX',
  'Singapore': 'SG',
  'Thailand': 'TH',
  'Indonesia': 'ID',
  'Malaysia': 'MY',
  'South Africa': 'ZA',
  'Argentina': 'AR',
  'Colombia': 'CO',
  'Egypt': 'EG',
  'Morocco': 'MA',
  'Qatar': 'QA',
  'Kuwait': 'KW',
  'Oman': 'OM',
  'Bahrain': 'BH',
  'Ethiopia': 'ET',
  'Kenya': 'KE',
  'Nigeria': 'NG',
  'Taiwan': 'TW',
  'Philippines': 'PH',
  'Vietnam': 'VN',
  'New Zealand': 'NZ',
  'Croatia': 'HR',
  'Bulgaria': 'BG',
  'Serbia': 'RS',
  'Ukraine': 'UA',
  'Lithuania': 'LT',
  'Latvia': 'LV',
  'Estonia': 'EE',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Malta': 'MT',
  'Cyprus': 'CY',
};

function countryToFlag(country: string): string | null {
  const code = COUNTRY_CODES[country];
  if (!code) return null;
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export type DataCellProps =
  | { type: 'text'; value: string; className?: string }
  | { type: 'callsign'; value: string; isExpanded?: boolean; isApproaching: boolean; isInZone?: boolean; className?: string }
  | { type: 'country'; value: string; className?: string }
  | { type: 'altitude'; value: number; className?: string }
  | { type: 'speed'; value: number; className?: string }
  | { type: 'verticalSpeed'; value: number; className?: string }
  | { type: 'heading'; value: number; className?: string }
  | { type: 'distance'; value: number; className?: string }
  | { type: 'eta'; value: number; className?: string }
  | { type: 'aircraftType'; value: string | null; className?: string }

function TextCell({ value, className }: { value: string; className?: string }) {
  return <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>{value}</td>;
}

function AirlineLogo({ callsign }: { callsign: string }) {
  const logoUrl = getAirlineLogoUrl(callsign);
  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt=""
      width={20}
      height={20}
      className="inline-block mr-1.5 rounded-full border border-border/40 object-contain bg-white"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function CallsignCell({ value, isExpanded, isApproaching, isInZone, className }: {
  value: string;
  isExpanded?: boolean;
  isApproaching: boolean;
  isInZone?: boolean;
  className?: string;
}) {
  const borderColor = isInZone ? 'border-l-2 border-blue-500' : isApproaching ? 'border-l-2 border-emerald-500' : '';
  return (
    <td className={`px-3 py-1.5 whitespace-nowrap ${borderColor} ${className ?? ''}`.trim()}>
      {isExpanded !== undefined && (
        <span className="mr-1.5 text-[10px] text-muted-foreground/60">{isExpanded ? '\u25BC' : '\u25B6'}</span>
      )}
      {isApproaching && <span className="mr-1">&#9992;</span>}
      <AirlineLogo callsign={value} />
      <span className="font-mono font-semibold tracking-wide">{value}</span>
    </td>
  );
}

function CountryCell({ value, className }: { value: string; className?: string }) {
  const flag = countryToFlag(value);
  return (
    <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>
      {flag ? (
        <span title={value} className="text-base cursor-default">{flag}</span>
      ) : (
        <span title={value}>{value || '-'}</span>
      )}
    </td>
  );
}

function AltitudeCell({ value, className }: { value: number; className?: string }) {
  const staggeredValue = useStaggeredValue(value, 6000);
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <NumberFlow
          value={staggeredValue}
          format={{ useGrouping: true }}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="text-muted-foreground text-[10px]">ft</span>
      </div>
    </td>
  );
}

function SpeedCell({ value, className }: { value: number; className?: string }) {
  const staggeredValue = useStaggeredValue(value, 6000);
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <NumberFlow
          value={staggeredValue}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="text-muted-foreground text-[10px]">kts</span>
      </div>
    </td>
  );
}

function VerticalSpeedCell({ value, className }: { value: number; className?: string }) {
  return <VsCell value={value} className={className} />;
}

function HeadingCell({ value, className }: { value: number; className?: string }) {
  const staggeredValue = useStaggeredValue(value, 6000);
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <NumberFlow
        value={staggeredValue}
        willChange
        trend={0}
        style={{ fontVariantNumeric: 'tabular-nums' }}
        suffix="°"
      />
    </td>
  );
}

function DistanceCell({ value, className }: { value: number; className?: string }) {
  const staggeredValue = useStaggeredValue(value, 6000);
  if (value <= 0) {
    return (
      <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
        <span className="text-muted-foreground">-</span>
      </td>
    );
  }

  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <NumberFlow
          value={staggeredValue}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="text-muted-foreground text-[10px]">km</span>
      </div>
    </td>
  );
}

function EtaCell({ value: rawMinutes, className }: { value: number; className?: string }) {
  // ETA is never staggered — always shows real-time countdown
  useStaggeredValue(rawMinutes, 6000); // call hook to maintain stable hook order
  const valid = Number.isFinite(rawMinutes) && rawMinutes >= 0;

  // Compute display values — always compute both major and minor to keep a stable render tree
  let major = 0;
  let minor = 0;
  let majorSuffix = ' min';
  let minorSuffix = '';
  let showMinor = false;

  if (valid) {
    if (rawMinutes < 1) {
      major = Math.round(rawMinutes * 60);
      majorSuffix = 's';
    } else if (rawMinutes < 5) {
      major = Math.floor(rawMinutes);
      minor = Math.round((rawMinutes - major) * 60);
      majorSuffix = 'm ';
      minorSuffix = 's';
      showMinor = true;
    } else if (rawMinutes < 60) {
      major = Math.round(rawMinutes);
      majorSuffix = ' min';
    } else {
      major = Math.floor(rawMinutes / 60);
      minor = Math.round(rawMinutes % 60);
      majorSuffix = 'h ';
      minorSuffix = 'm';
      showMinor = true;
    }
  }

  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      {!valid ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <>
          <NumberFlow value={major} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix={majorSuffix} />
          {showMinor && (
            <NumberFlow value={minor} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix={minorSuffix} />
          )}
        </>
      )}
    </td>
  );
}

function AircraftTypeCell({ value, className }: { value: string | null; className?: string }) {
  return (
    <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>
      <AircraftTypeBadge typeCode={value} />
    </td>
  );
}

export function DataCell(props: DataCellProps) {
  switch (props.type) {
    case 'text':
      return <TextCell value={props.value} className={props.className} />;
    case 'callsign':
      return <CallsignCell value={props.value} isExpanded={props.isExpanded} isApproaching={props.isApproaching} isInZone={props.isInZone} className={props.className} />;
    case 'country':
      return <CountryCell value={props.value} className={props.className} />;
    case 'altitude':
      return <AltitudeCell value={props.value} className={props.className} />;
    case 'speed':
      return <SpeedCell value={props.value} className={props.className} />;
    case 'verticalSpeed':
      return <VerticalSpeedCell value={props.value} className={props.className} />;
    case 'heading':
      return <HeadingCell value={props.value} className={props.className} />;
    case 'distance':
      return <DistanceCell value={props.value} className={props.className} />;
    case 'eta':
      return <EtaCell value={props.value} className={props.className} />;
    case 'aircraftType':
      return <AircraftTypeCell value={props.value} className={props.className} />;
  }
}
