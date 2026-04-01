import L from 'leaflet';
import {
  COLOR_DEFAULT,
  COLOR_APPROACHING,
  COLOR_IN_ZONE,
  COLOR_SELECTED,
} from './mapConstants';

// ---------------------------------------------------------------------------
// Aircraft classification
// ---------------------------------------------------------------------------

export type AircraftCategory = 'four-engine' | 'widebody' | 'narrowbody' | 'regional' | 'default';

const FOUR_ENGINE = new Set([
  'A388', 'A389',
  'B744', 'B748',
  'A342', 'A343', 'A344', 'A345', 'A346',
]);

const WIDEBODY = new Set([
  'A332', 'A333', 'A338', 'A339',
  'A359', 'A35K',
  'B772', 'B773', 'B77W', 'B77L',
  'B788', 'B789', 'B78X',
  'A306', 'A30B', 'A310',
  'B762', 'B763', 'B764',
  'IL96', 'MD11', 'DC10',
]);

const NARROWBODY = new Set([
  'A318', 'A319', 'A320', 'A321', 'A19N', 'A20N', 'A21N',
  'B733', 'B734', 'B735', 'B736', 'B737', 'B738', 'B739',
  'B38M', 'B39M', 'B3XM',
  'BCS1', 'BCS3', 'A223',
  'E170', 'E175', 'E190', 'E195', 'E290', 'E295',
  'B752', 'B753',
  'MD80', 'MD81', 'MD82', 'MD83', 'MD87', 'MD88', 'MD90',
]);

const REGIONAL = new Set([
  'AT43', 'AT45', 'AT72', 'AT76',
  'DH8A', 'DH8B', 'DH8C', 'DH8D',
  'CRJ1', 'CRJ2', 'CRJ7', 'CRJ9', 'CRJX',
  'E135', 'E145',
  'SF34', 'SB20', 'JS41', 'F50', 'F70', 'F100',
]);

export function classifyAircraft(typeCode: string | null | undefined): AircraftCategory {
  if (!typeCode) return 'default';
  const code = typeCode.trim().toUpperCase();
  if (FOUR_ENGINE.has(code)) return 'four-engine';
  if (WIDEBODY.has(code)) return 'widebody';
  if (NARROWBODY.has(code)) return 'narrowbody';
  if (REGIONAL.has(code)) return 'regional';
  return 'default';
}

// ---------------------------------------------------------------------------
// SVG generation
// ---------------------------------------------------------------------------

export function aircraftSvg(category: AircraftCategory, color: string): { svg: string; size: number } {
  switch (category) {
    case 'four-engine':
      return {
        size: 28,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
          <g fill="${color}">
            <rect x="12.5" y="1" width="3" height="26" rx="1.5"/>
            <polygon points="14,10 1,15 1,16.5 14,13"/>
            <polygon points="14,10 27,15 27,16.5 14,13"/>
            <polygon points="14,24 6,27 6,26 14,23"/>
            <polygon points="14,24 22,27 22,26 14,23"/>
            <rect x="3.5" y="12.5" width="1.8" height="4" rx="0.9"/>
            <rect x="7" y="11" width="1.8" height="4" rx="0.9"/>
            <rect x="19.2" y="11" width="1.8" height="4" rx="0.9"/>
            <rect x="22.7" y="12.5" width="1.8" height="4" rx="0.9"/>
          </g>
        </svg>`,
      };
    case 'widebody':
      return {
        size: 24,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <g fill="${color}">
            <rect x="10.5" y="1" width="3" height="22" rx="1.5"/>
            <polygon points="12,8 1,13 1,14.5 12,11"/>
            <polygon points="12,8 23,13 23,14.5 12,11"/>
            <polygon points="12,20 5.5,23 5.5,22 12,19.5"/>
            <polygon points="12,20 18.5,23 18.5,22 12,19.5"/>
            <rect x="5.5" y="10" width="2" height="3.5" rx="1"/>
            <rect x="16.5" y="10" width="2" height="3.5" rx="1"/>
          </g>
        </svg>`,
      };
    case 'narrowbody':
      return {
        size: 20,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
          <g fill="${color}">
            <rect x="8.5" y="1" width="3" height="18" rx="1.5"/>
            <polygon points="10,7 1,11 1,12.2 10,9.5"/>
            <polygon points="10,7 19,11 19,12.2 10,9.5"/>
            <polygon points="10,16.5 5,19 5,18 10,16"/>
            <polygon points="10,16.5 15,19 15,18 10,16"/>
            <rect x="4.5" y="9" width="1.5" height="3" rx="0.75"/>
            <rect x="14" y="9" width="1.5" height="3" rx="0.75"/>
          </g>
        </svg>`,
      };
    case 'regional':
      return {
        size: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
          <g fill="${color}">
            <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
            <rect x="0.5" y="5.5" width="15" height="1.8" rx="0.9"/>
            <polygon points="8,13 4,15.5 4,14.5 8,12.5"/>
            <polygon points="8,13 12,15.5 12,14.5 8,12.5"/>
          </g>
        </svg>`,
      };
    default:
      return {
        size: 16,
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
          <g fill="${color}">
            <rect x="6.5" y="1" width="3" height="14" rx="1.5"/>
            <rect x="1" y="6" width="14" height="1.5" rx="0.75"/>
            <polygon points="8,13 4.5,15.5 4.5,14.5 8,12.5"/>
            <polygon points="8,13 11.5,15.5 11.5,14.5 8,12.5"/>
          </g>
        </svg>`,
      };
  }
}

// ---------------------------------------------------------------------------
// Leaflet icon factories
// ---------------------------------------------------------------------------

export function createFlightIcon(
  track: number,
  isApproaching: boolean,
  aircraftType?: string | null,
  isInZone?: boolean,
  isSelected?: boolean
): L.DivIcon {
  const color = isSelected
    ? COLOR_SELECTED
    : isInZone
      ? COLOR_IN_ZONE
      : isApproaching
        ? COLOR_APPROACHING
        : COLOR_DEFAULT;
  const category = classifyAircraft(aircraftType);
  const { svg, size } = aircraftSvg(category, color);
  const half = size / 2;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(${track}deg);line-height:0;">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    className: '',
  });
}

/**
 * Shorten an ICAO type code by stripping the leading letter.
 * E.g. "B738" -> "738", "A320" -> "320".
 */
export function shortenTypeCode(typeCode: string | null | undefined): string {
  if (!typeCode) return '?';
  const trimmed = typeCode.trim();
  if (trimmed.length === 0) return '?';
  if (/^[A-Za-z]/.test(trimmed)) return trimmed.slice(1);
  return trimmed;
}

/**
 * Label-mode icon: outline triangle pointing in the direction of flight,
 * with the shortened type code displayed below it.
 */
export function createLabelIcon(
  track: number,
  aircraftType: string | null | undefined,
  isApproaching: boolean,
  isSelected: boolean,
  isInZone?: boolean
): L.DivIcon {
  const color = isSelected
    ? COLOR_SELECTED
    : isInZone
      ? COLOR_IN_ZONE
      : isApproaching
        ? COLOR_APPROACHING
        : COLOR_DEFAULT;
  const label = shortenTypeCode(aircraftType);
  const size = 40;
  const half = size / 2;

  const triSize = 18;
  const triHalf = triSize / 2;
  const triSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${triSize} ${triSize}" width="${triSize}" height="${triSize}">
    <polygon points="${triHalf},2 ${triSize - 2},${triSize - 2} 2,${triSize - 2}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

  const html = `<div style="width:${size}px;height:${size}px;position:relative;transform:rotate(${track}deg);">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;line-height:0;">${triSvg}</div>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-${track}deg);z-index:1;">
      <span style="font-size:9px;font-weight:700;font-family:system-ui,sans-serif;color:${color};line-height:1;white-space:nowrap;text-shadow:0 0 3px var(--background,#fff),0 0 3px var(--background,#fff);">${label}</span>
    </div>
  </div>`;

  return L.divIcon({
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
    className: '',
  });
}
