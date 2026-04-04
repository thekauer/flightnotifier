'use client';

import NumberFlow from '@number-flow/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { DEFAULT_AIRPORT, formatAirportCode } from '@/lib/defaultAirport';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import { usePresenceStore } from '@/lib/stores/presenceStore';
import { countryCodeToFlag } from '@/lib/airports';
import { runViewTransition } from '@/lib/viewTransitions';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/spotting', label: 'Spotting' },
  { href: '/settings', label: 'Settings' },
] as const;

export function NavigationHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useSelectedAirportsStore((state) => state.hasHydrated);
  const selectedAirport = useSelectedAirportsStore((state) => state.selectedAirports[0] ?? null);
  const hasCompletedOnboarding = useSelectedAirportsStore((state) => state.hasCompletedOnboarding);
  const reopenOnboarding = useSelectedAirportsStore((state) => state.reopenOnboarding);
  const airportUsers = usePresenceStore((state) => state.airportUsers);
  const presenceConnected = usePresenceStore((state) => state.connected);
  const currentAirport = hasHydrated ? selectedAirport ?? DEFAULT_AIRPORT : DEFAULT_AIRPORT;
  const airportCode = formatAirportCode(currentAirport);
  const airportFlag = countryCodeToFlag(currentAirport.countryCode);
  const airportBadgeClass = hasCompletedOnboarding ? 'airport-selector-transition ' : '';
  const showViewerCount = process.env.NODE_ENV === 'development' && hasHydrated;
  const navItems =
    process.env.NODE_ENV === 'development'
      ? [...NAV_ITEMS, { href: '/component', label: 'Components' }]
      : NAV_ITEMS;

  function handleAirportBadgeClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    runViewTransition(() => {
      reopenOnboarding();
      if (pathname !== '/') {
        router.push('/');
      }
    });
  }

  return (
    <header className="sticky top-0 z-[1200] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
        <div className="hidden sm:block">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">Flight Notifier</h1>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                onClick={handleAirportBadgeClick}
                className={`${airportBadgeClass}inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground transition hover:bg-secondary hover:text-foreground`}
              >
                <span className="mr-1.5 text-sm leading-none">{airportFlag}</span>
                {airportCode}
              </Link>
              {showViewerCount ? (
                <div
                  className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                    presenceConnected
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span
                      className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        presenceConnected ? 'animate-ping bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span
                      className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                        presenceConnected ? 'bg-emerald-300' : 'bg-amber-300'
                      }`}
                    />
                  </span>
                  <span className="text-[10px] tracking-[0.24em] text-current/80">Viewers</span>
                  <span className="text-xs font-bold tracking-normal text-current">
                    <NumberFlow
                      value={airportUsers}
                      willChange
                      trend={1}
                      transformTiming={{ duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
                      spinTiming={{ duration: 900, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                      opacityTiming={{ duration: 400, easing: 'ease-out' }}
                    />
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto sm:flex-none sm:ml-8" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap px-3 py-1.5 text-sm font-medium rounded-lg transition-colors sm:px-4 sm:py-2 ${
                  isActive
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 ml-2">
          <InstallPrompt />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
