import { AIRCRAFT_TYPE_HIERARCHY } from '@/lib/aircraftTypes';

export type AircraftCategory =
  | 'wide-body'
  | 'narrow-body'
  | 'regional'
  | 'general-aviation'
  | 'cargo'
  | 'unknown';

// Build a lookup map from ICAO type code -> category at module level
const TYPE_CODE_TO_CATEGORY: Record<string, AircraftCategory> = {};

const CATEGORY_MAP: Record<string, AircraftCategory> = {
  'Wide Body': 'wide-body',
  'Narrow Body': 'narrow-body',
  'Regional': 'regional',
  'General Aviation / Business': 'general-aviation',
  'Cargo': 'cargo',
};

for (const cat of AIRCRAFT_TYPE_HIERARCHY) {
  const mapped = CATEGORY_MAP[cat.category] ?? 'unknown';
  for (const fam of cat.families) {
    for (const v of fam.variants) {
      TYPE_CODE_TO_CATEGORY[v.code] = mapped;
    }
  }
}

/**
 * Determine the aircraft category from an ICAO type code.
 * Falls back to prefix-based heuristics for codes not in the hierarchy.
 */
export function getAircraftCategory(typeCode: string | null | undefined): AircraftCategory {
  if (!typeCode) return 'unknown';

  const upper = typeCode.toUpperCase().trim();

  // Direct lookup
  if (TYPE_CODE_TO_CATEGORY[upper]) {
    return TYPE_CODE_TO_CATEGORY[upper];
  }

  // Prefix-based heuristics for codes not in the hierarchy
  if (/^B74/.test(upper) || /^B77/.test(upper) || /^B78/.test(upper) ||
      /^A33/.test(upper) || /^A34/.test(upper) || /^A35/.test(upper) || /^A38/.test(upper)) {
    return 'wide-body';
  }
  if (/^B73/.test(upper) || /^B37/.test(upper) || /^B38/.test(upper) || /^B39/.test(upper) ||
      /^A3[12]/.test(upper) || /^A2[01]/.test(upper) || /^B75/.test(upper)) {
    return 'narrow-body';
  }
  if (/^AT/.test(upper) || /^CRJ/.test(upper) || /^DH8/.test(upper) ||
      /^E1[3-7]/.test(upper) || /^E75/.test(upper)) {
    return 'regional';
  }
  if (/^C[12]\d/.test(upper) || /^C5\d/.test(upper) || /^C6\d/.test(upper) ||
      /^GLF/.test(upper) || /^GLEX/.test(upper) || /^PC\d/.test(upper) ||
      /^BE\d/.test(upper) || /^LJ\d/.test(upper) || /^FA\d/.test(upper) ||
      /^CL\d/.test(upper) || /^GA\d/.test(upper) || /^P28/.test(upper) ||
      /^PA\d/.test(upper) || /^DA\d/.test(upper) || /^SR2/.test(upper)) {
    return 'general-aviation';
  }

  return 'unknown';
}

const CATEGORY_STYLES: Record<AircraftCategory, string> = {
  'wide-body':
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  'narrow-body':
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  'regional':
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  'general-aviation':
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  'cargo':
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  'unknown':
    'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/60 dark:text-gray-400 dark:border-gray-700',
};

interface AircraftTypeBadgeProps {
  typeCode: string | null | undefined;
  className?: string;
}

export function AircraftTypeBadge({ typeCode, className }: AircraftTypeBadgeProps) {
  if (!typeCode) {
    return <span className="text-muted-foreground">-</span>;
  }

  const category = getAircraftCategory(typeCode);
  const styles = CATEGORY_STYLES[category];

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${styles} ${className ?? ''}`.trim()}
      title={category.replace('-', ' ')}
    >
      {typeCode}
    </span>
  );
}
