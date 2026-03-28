import { VsCell } from './VsCell';
import { AircraftTypeBadge } from './AircraftTypeBadge';

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
  | { type: 'callsign'; value: string; isExpanded?: boolean; isApproaching: boolean; className?: string }
  | { type: 'country'; value: string; className?: string }
  | { type: 'altitude'; value: number; className?: string }
  | { type: 'speed'; value: number; className?: string }
  | { type: 'verticalSpeed'; value: number; className?: string }
  | { type: 'heading'; value: number; className?: string }
  | { type: 'distance'; value: number; className?: string }
  | { type: 'eta'; value: string; className?: string }
  | { type: 'aircraftType'; value: string | null; className?: string }

function TextCell({ value, className }: { value: string; className?: string }) {
  return <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>{value}</td>;
}

function CallsignCell({ value, isExpanded, isApproaching, className }: {
  value: string;
  isExpanded?: boolean;
  isApproaching: boolean;
  className?: string;
}) {
  return (
    <td className={`px-3 py-1.5 ${className ?? ''}`.trim()}>
      {isExpanded !== undefined && (
        <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
      )}
      {isApproaching && <span className="mr-1">&#9992;</span>}
      {value}
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
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <span>{value.toLocaleString()}</span>
        <span className="text-muted-foreground text-[10px]">ft</span>
      </div>
    </td>
  );
}

function SpeedCell({ value, className }: { value: number; className?: string }) {
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <span>{value}</span>
        <span className="text-muted-foreground text-[10px]">kts</span>
      </div>
    </td>
  );
}

function VerticalSpeedCell({ value, className }: { value: number; className?: string }) {
  return <VsCell value={value} className={className} />;
}

function HeadingCell({ value, className }: { value: number; className?: string }) {
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      {value}<span className="text-muted-foreground text-xs">°</span>
    </td>
  );
}

function DistanceCell({ value, className }: { value: number; className?: string }) {
  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <span>{value}</span>
        <span className="text-muted-foreground text-[10px]">km</span>
      </div>
    </td>
  );
}

function EtaCell({ value, className }: { value: string; className?: string }) {
  return <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>{value}</td>;
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
      return <CallsignCell value={props.value} isExpanded={props.isExpanded} isApproaching={props.isApproaching} className={props.className} />;
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
