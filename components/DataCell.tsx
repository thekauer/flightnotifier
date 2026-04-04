'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { VsCell } from './VsCell';
import { AircraftTypeBadge } from './AircraftTypeBadge';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirlineLogoUrl } from '@/lib/airlineLogo';
import { useEtaFormat } from '@/lib/etaFormatContext';
import { countryNameToFlag } from '@/lib/constants/countryCodes';

export type DataCellProps =
  | { type: 'text'; value: string; className?: string }
  | { type: 'callsign'; value: string; isExpanded?: boolean; isApproaching: boolean; isInZone?: boolean; className?: string }
  | { type: 'country'; value: string; className?: string }
  | { type: 'altitude'; value: number; className?: string }
  | { type: 'speed'; value: number; className?: string }
  | { type: 'verticalSpeed'; value: number; className?: string }
  | { type: 'heading'; value: number; className?: string }
  | { type: 'distance'; value: number; className?: string }
  | { type: 'eta'; value: number; etaTimestampMs?: number; className?: string }
  | { type: 'aircraftType'; value: string | null; className?: string }

let etaClockNow = Date.now();
const etaClockListeners = new Set<() => void>();
let etaClockInterval: ReturnType<typeof setInterval> | null = null;

function subscribeToEtaClock(listener: () => void) {
  etaClockListeners.add(listener);

  if (!etaClockInterval) {
    etaClockInterval = setInterval(() => {
      etaClockNow = Date.now();
      for (const notify of etaClockListeners) {
        notify();
      }
    }, 1000);
  }

  return () => {
    etaClockListeners.delete(listener);
    if (etaClockListeners.size === 0 && etaClockInterval) {
      clearInterval(etaClockInterval);
      etaClockInterval = null;
    }
  };
}

function useEtaClockNow() {
  const [now, setNow] = useState(etaClockNow);

  useEffect(() => {
    etaClockNow = Date.now();
    setNow(etaClockNow);
    return subscribeToEtaClock(() => {
      setNow(etaClockNow);
    });
  }, []);

  return now;
}

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
  const flag = countryNameToFlag(value);
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

  const showDecimal = staggeredValue < 10;

  return (
    <td className={`px-3 py-1.5 text-right ${className ?? ''}`.trim()}>
      <div className="flex flex-col items-end leading-tight">
        <NumberFlow
          value={showDecimal ? Math.round(staggeredValue * 10) / 10 : Math.round(staggeredValue)}
          willChange
          trend={0}
          format={showDecimal ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : undefined}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        />
        <span className="text-muted-foreground text-[10px]">km</span>
      </div>
    </td>
  );
}

function EtaCell({
  value: rawMinutes,
  etaTimestampMs,
  className,
}: {
  value: number;
  etaTimestampMs?: number;
  className?: string;
}) {
  const now = useEtaClockNow();
  const { etaFormat } = useEtaFormat();
  const [derivedEtaTimestampMs, setDerivedEtaTimestampMs] = useState<number | null>(() =>
    Number.isFinite(rawMinutes) && rawMinutes >= 0 ? Date.now() + rawMinutes * 60_000 : null,
  );

  useEffect(() => {
    if (!Number.isFinite(rawMinutes) || rawMinutes < 0) {
      setDerivedEtaTimestampMs(null);
      return;
    }

    setDerivedEtaTimestampMs(Date.now() + rawMinutes * 60_000);
  }, [rawMinutes]);

  const targetTimestampMs = etaTimestampMs ?? derivedEtaTimestampMs;
  const remainingMs = targetTimestampMs === null ? NaN : Math.max(0, targetTimestampMs - now);
  const valid = Number.isFinite(remainingMs);

  const totalSeconds = valid ? Math.ceil(remainingMs / 1000) : 0;
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
      ) : totalSeconds < 60 ? (
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
      return <EtaCell value={props.value} etaTimestampMs={props.etaTimestampMs} className={props.className} />;
    case 'aircraftType':
      return <AircraftTypeCell value={props.value} className={props.className} />;
  }
}
