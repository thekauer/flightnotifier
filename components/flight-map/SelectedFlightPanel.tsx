'use client';

import NumberFlow from '@number-flow/react';
import type { Flight } from '@/lib/types';
import { AircraftTypeBadge } from '@/components/AircraftTypeBadge';
import { VsCell } from '@/components/VsCell';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

function InlineAltitude({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">Alt</span>
      <div className="flex items-baseline gap-1">
        <NumberFlow
          value={staggered}
          format={{ useGrouping: true }}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-xl font-bold text-foreground"
        />
        <span className="text-xs text-muted-foreground">ft</span>
      </div>
    </div>
  );
}

function InlineSpeed({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">Speed</span>
      <div className="flex items-baseline gap-1">
        <NumberFlow
          value={staggered}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-xl font-bold text-foreground"
        />
        <span className="text-xs text-muted-foreground">kts</span>
      </div>
    </div>
  );
}

function InlineHeading({ value }: { value: number }) {
  const staggered = useStaggeredValue(value, 6000);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">Hdg</span>
      <NumberFlow
        value={staggered}
        willChange
        trend={0}
        style={{ fontVariantNumeric: 'tabular-nums' }}
        suffix={'\u00B0'}
        className="text-xl font-bold text-foreground"
      />
    </div>
  );
}

function InlineVs({ value }: { value: number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">V/S</span>
      <div className="text-xl font-bold">
        <VsCell value={value} asTableCell={false} className="justify-start" />
      </div>
    </div>
  );
}

function AirportBadge({ label, iata }: { label: string; iata: string }) {
  const info = getAirportInfo(iata);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">{label}</span>
      {info ? (
        <span className="text-xl font-bold text-foreground" title={info.city}>
          {countryCodeToFlag(info.countryCode)} {info.iata}
        </span>
      ) : (
        <span className="text-xl font-bold text-foreground">{iata}</span>
      )}
    </div>
  );
}

export function SelectedFlightPanel({ flight }: { flight: Flight }) {
  return (
    <div className="border-t bg-muted/40 px-6 py-4">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <div className="flex flex-col leading-tight">
          <span className="text-sm text-muted-foreground">Type</span>
          <div className="text-xl font-bold">
            <AircraftTypeBadge typeCode={flight.aircraftType} />
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm text-muted-foreground">Callsign</span>
          <span className="text-xl font-bold font-mono tracking-wide">{flight.callsign || flight.id}</span>
        </div>
        {flight.origin && <AirportBadge label="From" iata={flight.origin} />}
        {flight.destination && <AirportBadge label="To" iata={flight.destination} />}
        {!flight.origin && !flight.destination && <div className="col-span-2" />}
        {flight.origin && !flight.destination && <div />}
        <InlineAltitude value={flight.alt} />
        <InlineSpeed value={flight.speed} />
        <InlineHeading value={flight.track} />
        <InlineVs value={flight.verticalRate} />
      </div>
    </div>
  );
}
