'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LocateFixed, PencilLine, Search } from 'lucide-react';
import { RunwayLabMap } from '@/components/runway-lab/RunwayLabMap';
import { countryCodeToFlag } from '@/lib/airports';
import type { AirportSearchRecord } from '@/lib/airport-catalog';
import { cn } from '@/lib/utils';
import { DEFAULT_AIRPORT, formatAirportCode, formatAirportSubtitle } from '@/lib/defaultAirport';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import type { SelectedRunwayRecord } from '@/lib/runwaySelection';
import { runViewTransition } from '@/lib/viewTransitions';

function ResultRow({
  airport,
  onSelect,
}: {
  airport: AirportSearchRecord;
  onSelect: (airport: AirportSearchRecord) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(airport)}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/6 focus-visible:bg-white/6 focus-visible:outline-none"
    >
      <div className="mt-0.5 flex h-11 w-8 shrink-0 items-center justify-center text-lg">
        {countryCodeToFlag(airport.countryCode)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15px] font-semibold text-foreground">{airport.name}</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:bg-white/8">
            {formatAirportCode(airport)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{formatAirportSubtitle(airport)}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">{airport.ident}</p>
      </div>
    </button>
  );
}

export function OnboardingPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const selectedAirports = useSelectedAirportsStore((state) => state.selectedAirports);
  const selectedRunways = useSelectedAirportsStore((state) => state.selectedRunways);
  const forceAirportEditing = useSelectedAirportsStore((state) => state.forceAirportEditing);
  const setSelectedAirport = useSelectedAirportsStore((state) => state.setSelectedAirport);
  const toggleSelectedRunway = useSelectedAirportsStore((state) => state.toggleSelectedRunway);
  const completeOnboarding = useSelectedAirportsStore((state) => state.completeOnboarding);
  const consumeAirportEditingRequest = useSelectedAirportsStore((state) => state.consumeAirportEditingRequest);

  const storedAirport = selectedAirports[0] ?? null;
  const [selectedAirport, setSelectedAirportState] = useState<AirportSearchRecord>(storedAirport ?? DEFAULT_AIRPORT);
  const [isEditing, setIsEditing] = useState(!storedAirport || forceAirportEditing);
  const [isContinuing, setIsContinuing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AirportSearchRecord[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const continueSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!storedAirport) return;
    setSelectedAirportState(storedAirport);
    setIsEditing(forceAirportEditing);
  }, [forceAirportEditing, storedAirport]);

  useEffect(() => {
    if (!forceAirportEditing) return;
    consumeAirportEditingRequest();
  }, [consumeAirportEditingRequest, forceAirportEditing]);

  useEffect(() => {
    if (!isEditing) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    setIsSearching(true);
    setSearchError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/airports/search?q=${encodeURIComponent(trimmedQuery)}&limit=14`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const airports = (await response.json()) as AirportSearchRecord[];
        setResults(airports);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        setResults([]);
        setSearchError('Airport search is unavailable right now.');
      } finally {
        setIsSearching(false);
      }
    }, 140);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isEditing, query]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const currentAirport = useMemo(() => selectedAirport ?? DEFAULT_AIRPORT, [selectedAirport]);
  const selectedRunwaysForAirport = useMemo(
    () => selectedRunways.filter((runway) => runway.airportIdent === currentAirport.ident),
    [currentAirport.ident, selectedRunways],
  );
  const hasSelectedRunways = selectedRunwaysForAirport.length > 0;

  useEffect(() => {
    if (!hasSelectedRunways) return;
    void import('@/components/flight-map/FlightMapInner');
  }, [hasSelectedRunways]);

  function scrollMapIntoView() {
    mapSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function handleSelectAirport(airport: AirportSearchRecord) {
    setSelectedAirportState(airport);
    setSelectedAirport(airport);
    setIsEditing(false);
    setIsInputFocused(false);
    setQuery('');
    setResults([]);
    setSearchError(null);
    setLocationError(null);
    window.setTimeout(scrollMapIntoView, 70);
  }

  function handleEditSelection() {
    setIsEditing(true);
    setQuery('');
    setLocationError(null);
    setSearchError(null);
  }

  async function handleLocateNearestAirport() {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const response = await fetch(
        `/api/airports/nearest?lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
      );

      if (!response.ok) {
        throw new Error('Nearest airport lookup failed');
      }

      const airport = (await response.json()) as AirportSearchRecord;
      handleSelectAirport(airport);
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location access was denied.');
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Location lookup timed out.');
        } else {
          setLocationError('Unable to determine your location.');
        }
      } else {
        setLocationError('Unable to find the closest airport right now.');
      }
    } finally {
      setIsLocating(false);
    }
  }

  function handleSelectRunway(runway: SelectedRunwayRecord) {
    toggleSelectedRunway(runway);
    window.setTimeout(() => {
      continueSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
  }

  async function handleContinue() {
    if (!hasSelectedRunways || isContinuing) return;

    setIsContinuing(true);

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 220);
    });

    const goToDashboard = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      completeOnboarding();
      if (pathname !== '/') {
        router.push('/');
      }
    };

    runViewTransition(goToDashboard);
  }

  return (
    <main className="page-shell-transition min-h-screen bg-background">
      <section className="relative z-10 -mb-10 px-4 pb-0 pt-4 sm:-mb-12 sm:px-6 sm:pt-6 lg:-mb-16 lg:px-8 lg:pt-8">
        <div className="mx-auto w-full max-w-[1600px] overflow-hidden rounded-[2rem] bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]">
          <div className="h-[82vh] min-h-[700px] w-full bg-background">
            <div className="flex h-full min-h-0 flex-col bg-background">
              <div className="relative z-20 px-4 pb-1 pt-3 sm:px-6 sm:pb-1 sm:pt-4">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5">
                  <div className="space-y-1 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Onboarding</p>
                    <h1 className="text-balance font-['Avenir_Next','Segoe_UI',sans-serif] text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2.7rem]">
                      Search any airport, or start from where you are.
                    </h1>
                    <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
                      Pick the airport you want to focus on first, then click the runway you care about. We&apos;ll keep both in local storage and use them to carry you into the dashboard.
                    </p>
                  </div>

                  <div className="mx-auto w-full max-w-3xl">
                    <div className="flex items-start gap-3">
                      <div className="relative flex-1">
                        {isEditing ? (
                          <div className="overflow-hidden rounded-[1.2rem] border border-black/8 bg-neutral-900 text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] transition-[border-radius,box-shadow] duration-150 ease-out dark:border-white/10 dark:bg-neutral-950">
                            <div className="airport-selector-transition flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
                              <Search className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                              <input
                                ref={inputRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                onBlur={() => window.setTimeout(() => setIsInputFocused(false), 120)}
                                placeholder="Search airports or type a country"
                                className="h-8 w-full bg-transparent font-['Avenir_Next','Segoe_UI',sans-serif] text-base text-white outline-none placeholder:text-neutral-400 sm:text-[1.2rem]"
                                aria-label="Search airports or countries"
                              />
                              <div className="h-7 w-px shrink-0 bg-white/10" />
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={handleLocateNearestAirport}
                                disabled={isLocating}
                                className={cn(
                                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-white/8 hover:text-white',
                                  isLocating && 'cursor-wait opacity-70',
                                )}
                                aria-label="Use my location to find the closest airport"
                              >
                                <LocateFixed className={cn('h-4.5 w-4.5', isLocating && 'animate-pulse')} />
                              </button>
                            </div>

                            <div
                              className={cn(
                                'grid transition-[grid-template-rows,opacity] duration-150 ease-out',
                                isInputFocused ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                              )}
                            >
                              <div className="overflow-hidden">
                                <div className="border-t border-white/10 px-5 py-2 text-xs text-neutral-400 sm:px-7">
                                  Examples: `Schiphol`, `AMS`, `EHAM`, `Japan`, `United States`
                                </div>
                              </div>
                            </div>

                            <div
                              className={cn(
                                'grid transition-[grid-template-rows,opacity] duration-150 ease-out',
                                query.trim() || isSearching || searchError ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                              )}
                            >
                              <div className="overflow-hidden">
                                <div className="border-t border-white/10 py-2">
                                  <div className="max-h-[24rem] overflow-y-auto">
                                    {isSearching ? (
                                      <div className="px-4 py-5 text-sm text-neutral-400">Searching airports...</div>
                                    ) : searchError ? (
                                      <div className="px-4 py-5 text-sm text-destructive">{searchError}</div>
                                    ) : results.length === 0 ? (
                                      <div className="px-4 py-5 text-sm text-neutral-400">No airports matched that search.</div>
                                    ) : (
                                      results.map((airport) => (
                                        <ResultRow
                                          key={`${airport.ident}-${airport.latitude}-${airport.longitude}`}
                                          airport={airport}
                                          onSelect={handleSelectAirport}
                                        />
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="group flex min-h-[4.5rem] items-center gap-4 rounded-[1.2rem] border border-black/8 bg-neutral-900 px-4 py-3 text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-neutral-950 sm:px-5">
                            <div className="flex h-14 w-8 shrink-0 items-center justify-center text-[1.75rem]">
                              {countryCodeToFlag(currentAirport.countryCode)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-['Avenir_Next','Segoe_UI',sans-serif] text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
                                  {currentAirport.name}
                                </span>
                                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-300">
                                  {formatAirportCode(currentAirport)}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-sm text-neutral-400">{formatAirportSubtitle(currentAirport)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleEditSelection}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-neutral-400 opacity-100 transition hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                              aria-label="Edit selected airport"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {locationError ? <p className="mt-3 text-sm text-destructive">{locationError}</p> : null}
                  </div>
                </div>
              </div>

              <div ref={mapSectionRef} className="mt-24 min-h-0 flex-1 sm:mt-10">
                <div className="h-full overflow-hidden rounded-2xl bg-card">
                  <RunwayLabMap
                    airport={currentAirport}
                    selectedRunways={selectedRunwaysForAirport}
                    interactiveRunways={!isEditing}
                    hideUnselectedRunways={hasSelectedRunways}
                    dashSelectedRunways={isContinuing}
                    onRunwaySelect={handleSelectRunway}
                    className="airport-map-transition h-full w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/20 px-6 pb-10 pt-20 sm:px-8 sm:pt-24 lg:pt-28">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Airport Setup</p>
            <h2 className="text-2xl font-semibold tracking-tight">Pick a runway before we continue</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Click one or more runways on the map. As soon as you do, a continue action appears here and the dashboard will inherit that runway focus.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Saved Focus</p>
              <h3 className="mt-3 text-xl font-semibold">{currentAirport.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{formatAirportSubtitle(currentAirport)}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {currentAirport.ident}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {formatAirportCode(currentAirport)}
                </span>
              </div>
            </div>

            <div ref={continueSectionRef} className="rounded-3xl border bg-card p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Runway Selection</p>
              <h3 className="mt-3 text-xl font-semibold">
                {hasSelectedRunways ? 'Continue to the dashboard' : 'Select a runway on the map'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {hasSelectedRunways
                  ? 'Continue will hide the other runways, dash the selected ones, and then hand the map off into the dashboard view.'
                  : 'Hover and click the runway strips on the map above. You can select more than one before continuing.'}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedRunwaysForAirport.length > 0 ? (
                  selectedRunwaysForAirport.map((runway) => (
                    <span
                      key={runway.key}
                      className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                      {runway.leIdent}/{runway.heIdent}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    No runway selected yet
                  </span>
                )}
              </div>
              <div className="mt-5 min-h-10">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!hasSelectedRunways || isContinuing}
                  className={cn(
                    'inline-flex rounded-full px-4 py-2 text-sm font-medium transition',
                    hasSelectedRunways
                      ? 'bg-foreground text-background hover:opacity-90 disabled:cursor-wait disabled:opacity-70'
                      : 'pointer-events-none bg-muted text-muted-foreground opacity-0',
                  )}
                >
                  {isContinuing ? 'Transitioning…' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
