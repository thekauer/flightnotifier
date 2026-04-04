import { notFound } from 'next/navigation';
import { RunwayLabExplorer } from '@/components/runway-lab/RunwayLabExplorer';
import { AircraftSpottingGrid } from '@/components/ui/aircraft-spotting-grid';
import { AIRCRAFT_SPOTTING_TRAITS } from '@/lib/aircraftSpottingTraits';

export default function ComponentPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative z-10 -mb-10 px-4 pb-0 pt-4 sm:-mb-12 sm:px-6 sm:pt-6 lg:-mb-16 lg:px-8 lg:pt-8">
        <div className="mx-auto w-full max-w-[1600px] overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
          <div className="h-[82vh] min-h-[700px] w-full">
            <RunwayLabExplorer />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/20 px-6 pb-10 pt-20 sm:px-8 sm:pt-24 lg:pt-28">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Aircraft Spotting Grid
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Dev component preview</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Apple-style six-slot spotting cards with per-cell highlighting for aircraft recognition traits.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-medium">Boeing 777</h2>
                <p className="text-sm text-muted-foreground">Tail highlight and classic widebody Boeing cues.</p>
              </div>
              <AircraftSpottingGrid items={AIRCRAFT_SPOTTING_TRAITS.B77W} />
            </div>

            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-medium">Boeing 787</h2>
                <p className="text-sm text-muted-foreground">Engine chevrons highlighted with Dreamliner-specific shapes.</p>
              </div>
              <AircraftSpottingGrid items={AIRCRAFT_SPOTTING_TRAITS.B789} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
