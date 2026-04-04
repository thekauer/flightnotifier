'use client';

import NumberFlow from '@number-flow/react';
import type { Flight } from '@/lib/types';
import { AircraftTypeBadge } from '@/components/AircraftTypeBadge';
import { VsCell } from '@/components/VsCell';
import { AppleSixGridCard } from '@/components/ui/apple-six-grid-card';
import { useStaggeredValue } from '@/hooks/useStaggeredValue';
import { getAirportInfo, countryCodeToFlag } from '@/lib/airports';

function AirportBadge({ label, iata }: { label: string; iata: string }) {
  const info = getAirportInfo(iata);
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      {info ? (
        <span className="mt-2 text-lg font-bold text-foreground" title={info.city}>
          {countryCodeToFlag(info.countryCode)} {info.iata}
        </span>
      ) : (
        <span className="mt-2 text-lg font-bold text-foreground">{iata}</span>
      )}
    </div>
  );
}

function RouteCell({ label, iata }: { label: string; iata?: string | null }) {
  if (!iata) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className="mt-2 text-lg font-bold text-foreground">-</span>
      </div>
    );
  }

  return <AirportBadge label={label} iata={iata} />;
}

function FlightStateCell({ flight }: { flight: Flight }) {
  const altitude = useStaggeredValue(flight.alt, 6000);

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Flight State</span>
      <div className="mt-2 flex items-baseline gap-1">
        <NumberFlow
          value={altitude}
          format={{ useGrouping: true }}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-base font-bold text-foreground"
        />
        <span className="text-[11px] text-muted-foreground">ft</span>
      </div>
      <div className="mt-2">
        <VsCell value={flight.verticalRate} asTableCell={false} className="justify-start" />
      </div>
    </div>
  );
}

function MotionCell({ flight }: { flight: Flight }) {
  const speed = useStaggeredValue(flight.speed, 6000);
  const heading = useStaggeredValue(flight.track, 6000);

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Motion</span>
      <div className="mt-2 flex items-baseline gap-1">
        <NumberFlow
          value={speed}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          className="text-base font-bold text-foreground"
        />
        <span className="text-[11px] text-muted-foreground">kts</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <NumberFlow
          value={heading}
          willChange
          trend={0}
          style={{ fontVariantNumeric: 'tabular-nums' }}
          suffix={'\u00B0'}
          className="text-sm font-semibold text-foreground"
        />
        <span className="text-[11px] text-muted-foreground">hdg</span>
      </div>
    </div>
  );
}

export function SelectedFlightPanel({ flight }: { flight: Flight }) {
  return (
    <div className="h-full overflow-y-auto border-t bg-muted/40 px-4 py-3 sm:px-5">
      <AppleSixGridCard
        orientation="vertical"
        chrome="plain"
        className="mx-auto h-[296px] max-w-3xl"
        cellClassName="px-3 py-3"
        minCellHeight={0}
        dividerInset={8}
        dividerThickness={1.5}
      >
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Type</span>
          <div className="mt-2 text-base font-bold">
            <AircraftTypeBadge typeCode={flight.aircraftType} className="text-[11px]" />
          </div>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Callsign</span>
          <span className="mt-2 text-base font-bold font-mono tracking-wide text-foreground">{flight.callsign || flight.id}</span>
        </div>
        <RouteCell label="From" iata={flight.origin} />
        <RouteCell label="To" iata={flight.destination} />
        <FlightStateCell flight={flight} />
        <MotionCell flight={flight} />
      </AppleSixGridCard>
    </div>
  );
}
