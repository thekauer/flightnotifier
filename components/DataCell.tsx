'use client';

import NumberFlow from '@number-flow/react';
import { VsCell } from './VsCell';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirlineLogoUrl } from '@/lib/airlineLogo';
import { useEtaFormat } from '@/lib/etaFormatContext';

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
      className="inline-block mr-1.5 rounded-full border border-border/40 object-contain bg-transparent"
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
  return (
    <td className={`px-3 py-1.5 whitespace-nowrap ${className ?? ''}`.trim()}>
      {isExpanded !== undefined && (
        <svg
          className="inline-block mr-1.5 text-muted-foreground/60 transition-transform duration-200 align-middle"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M3 2L7 5L3 8" />
        </svg>
      )}
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
  const { etaFormat } = useEtaFormat();
  const valid = Number.isFinite(rawMinutes) && rawMinutes >= 0;

  // Convert rawMinutes to total seconds, then decompose
  const totalSeconds = valid ? Math.round(rawMinutes * 60) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isColon = etaFormat === 'colon';
  const padTwo = { minimumIntegerDigits: 2 } as const;

  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      {!valid ? (
        <span className="text-muted-foreground">—</span>
      ) : hours >= 1 ? (
        // >= 60 min: H:MM:SS or HhM'SS"
        isColon ? (
          <>
            <NumberFlow value={hours} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix=":" />
            <NumberFlow value={minutes} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} suffix=":" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} />
          </>
        ) : (
          <>
            <NumberFlow value={hours} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix="h" />
            <NumberFlow value={minutes} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix="'" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix={'"'} />
          </>
        )
      ) : rawMinutes < 1 ? (
        // < 1 min: 0:SS or 0'SS"
        isColon ? (
          <>
            <NumberFlow value={0} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix=":" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} />
          </>
        ) : (
          <>
            <NumberFlow value={0} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix="'" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} suffix={'"'} />
          </>
        )
      ) : (
        // 1-59 min: MM:SS or MM'SS"
        isColon ? (
          <>
            <NumberFlow value={minutes} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix=":" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} />
          </>
        ) : (
          <>
            <NumberFlow value={minutes} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} suffix="'" />
            <NumberFlow value={seconds} willChange trend={-1} style={{ fontVariantNumeric: 'tabular-nums' }} format={padTwo} suffix={'"'} />
          </>
        )
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
