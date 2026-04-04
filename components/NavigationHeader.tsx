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
  const navItems =
    process.env.NODE_ENV === 'development'
      ? [...NAV_ITEMS, { href: '/component', label: 'Components' }]
      : NAV_ITEMS;

  return (
    <header className="sticky top-0 z-[1200] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-3 py-3 sm:px-6 sm:py-4">
        <div className="hidden sm:block">
          <h1 className="text-xl font-bold tracking-tight">Flight Notifier</h1>
          <p className="text-sm text-muted-foreground">Schiphol Buitenveldertbaan Monitor</p>
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
