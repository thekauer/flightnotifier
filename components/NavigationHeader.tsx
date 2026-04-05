'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { formatAirportCode } from '@/lib/defaultAirport';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import { countryCodeToFlag } from '@/lib/airports';
import { runViewTransition } from '@/lib/viewTransitions';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
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
  const currentAirport = hasHydrated ? selectedAirport : null;
  const airportFlag = currentAirport ? countryCodeToFlag(currentAirport.countryCode) : null;
  const airportBadgeClass = hasCompletedOnboarding ? 'airport-selector-transition ' : '';
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
            {currentAirport ? (
              <Link
                href="/"
                onClick={handleAirportBadgeClick}
                className={`${airportBadgeClass}inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground transition hover:bg-secondary hover:text-foreground`}
              >
                <span className="mr-1.5 text-sm leading-none">{airportFlag}</span>
                {formatAirportCode(currentAirport)}
              </Link>
            ) : null}
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
