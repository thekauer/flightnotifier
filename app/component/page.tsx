import { notFound } from 'next/navigation';
import { AdsbLandingTracksExplorer } from '@/components/AdsbLandingTracksExplorer';
import { AircraftSpottingGrid } from '@/components/ui/aircraft-spotting-grid';
import { AIRCRAFT_SPOTTING_TRAITS } from '@/lib/aircraftSpottingTraits';

export default function ComponentPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="px-6 pb-10 pt-8 sm:px-8 sm:pt-10 lg:pt-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Aircraft Spotting Grid
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Dev component preview</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Experimental UI space for aircraft components plus a real-data map of Amsterdam arrivals built from our
              stored ADSB-Lol points.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-medium">Amsterdam Landing Tracks</h2>
              <p className="max-w-3xl text-sm text-muted-foreground">
                ADSB-Lol replay grouped by aircraft, with a UTC date selector so we can inspect any day directly from
                the database across airports.
              </p>
            </div>
            <AdsbLandingTracksExplorer />
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
