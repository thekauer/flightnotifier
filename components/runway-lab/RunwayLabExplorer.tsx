'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, PencilLine, Search } from 'lucide-react';
import { RunwayLabMap } from '@/components/runway-lab/RunwayLabMap';
import { countryCodeToFlag } from '@/lib/airports';
import type { AirportSearchRecord } from '@/lib/airport-catalog';
import { cn } from '@/lib/utils';

const DEFAULT_AIRPORT: AirportSearchRecord = {
  ident: 'EHAM',
  iata: 'AMS',
  name: 'Amsterdam Airport Schiphol',
  municipality: 'Amsterdam',
  countryCode: 'NL',
  country: 'Netherlands',
  latitude: 52.3086013793945,
  longitude: 4.763889789581299,
  type: 'large_airport',
  scheduledService: true,
};

function airportSubtitle(airport: AirportSearchRecord): string {
  return [airport.municipality, airport.country].filter(Boolean).join(', ');
}

function airportDisplayCode(airport: AirportSearchRecord): string {
  return airport.iata ?? airport.ident;
}

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
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/6 focus-visible:outline-none focus-visible:bg-white/6"
    >
      <div className="mt-0.5 flex h-11 w-8 shrink-0 items-center justify-center text-lg">
        {countryCodeToFlag(airport.countryCode)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[15px] font-semibold text-foreground">{airport.name}</span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase dark:bg-white/8">
            {airportDisplayCode(airport)}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{airportSubtitle(airport)}</p>
        <p className="mt-1 text-xs font-medium tracking-[0.16em] text-muted-foreground/80 uppercase">{airport.ident}</p>
      </div>
    </button>
  );
}

export function RunwayLabExplorer() {
  const [selectedAirport, setSelectedAirport] = useState<AirportSearchRecord>(DEFAULT_AIRPORT);
  const [isEditing, setIsEditing] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AirportSearchRecord[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);

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

  function scrollMapIntoView() {
    mapSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function handleSelectAirport(airport: AirportSearchRecord) {
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
        `/api/airports/nearest?lat=${position.coords.latitude}&lon=${position.coords.longitude}`
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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="relative z-20 px-4 pb-1 pt-3 sm:px-6 sm:pb-1 sm:pt-4">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-1.5">
          <div className="space-y-1 text-center">
            <p className="text-[11px] font-semibold tracking-[0.28em] text-muted-foreground uppercase">Runway Lab</p>
            <h1 className="text-balance font-['Avenir_Next','Segoe_UI',sans-serif] text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2.7rem]">
              Search any airport, or start from where you are.
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              Try an airport name, ICAO, IATA, city, or a full country to list airports there.
            </p>
          </div>

          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-start gap-3">
              <div className="relative flex-1">
                {isEditing ? (
                  <div className="overflow-hidden rounded-[1.2rem] border border-black/8 bg-neutral-900 text-white shadow-[0_20px_45px_-30px_rgba(15,23,42,0.4)] transition-[border-radius,box-shadow] duration-150 ease-out dark:border-white/10 dark:bg-neutral-950">
                    <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
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
                          isLocating && 'cursor-wait opacity-70'
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
                        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-semibold tracking-[0.18em] text-neutral-300 uppercase">
                          {airportDisplayCode(currentAirport)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-neutral-400">{airportSubtitle(currentAirport)}</p>
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

      <div ref={mapSectionRef} className="min-h-0 flex-1 mt-24 sm:mt-10">
        <div className="h-full overflow-hidden rounded-2xl bg-card">
          <RunwayLabMap airport={currentAirport} />
        </div>
      </div>
    </div>
  );
}
