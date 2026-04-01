'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/predictions', label: 'Predictions' },
  { href: '/spotting', label: 'Spotting' },
  { href: '/settings', label: 'Settings' },
] as const;

export function NavigationHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Flight Notifier</h1>
            <p className="text-sm text-muted-foreground">Schiphol Buitenveldertbaan Monitor</p>
          </div>

          <nav className="flex gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
        </div>
        <div className="flex items-center gap-2">
          <InstallPrompt />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
