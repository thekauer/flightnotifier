'use client';

import { useMemo, useState } from 'react';
import { useFlightEvents } from '@/hooks/useFlightEvents';
import { useNotificationZone } from '@/lib/notificationZoneContext';
import { StatusBanner } from '@/components/StatusBanner';
import { FlightMap } from '@/components/FlightMap';
import { FlightList } from '@/components/FlightList';
import { ConeFlightsTable } from '@/components/ConeFlightsTable';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { SettingsPage } from '@/components/SettingsPage';
import { WeatherCard } from '@/components/WeatherCard';
import { SpottingQuiz } from '@/components/SpottingQuiz';
import { ScheduledArrivalsTable } from '@/components/ScheduledArrivalsTable';

type TopTab = 'dashboard' | 'predictions' | 'spotting' | 'settings';

const TOP_TABS: { id: TopTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'predictions', label: 'Predictions' },
  { id: 'spotting', label: 'Spotting' },
  { id: 'settings', label: 'Settings' },
];

export default function Home() {
  const { state, connected, requestNotificationPermission } = useFlightEvents();
  const { zone, isInZone } = useNotificationZone();
  const [topTab, setTopTab] = useState<TopTab>('dashboard');
  const approachingIds = useMemo(
    () => new Set(state.approachingFlights.map((f) => f.id)),
    [state.approachingFlights],
  );
  const zoneFlights = useMemo(
    () => (zone ? state.allFlights.filter((f) => !f.onGround && isInZone(f.lat, f.lon)) : []),
    [zone, isInZone, state.allFlights],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Flight Notifier</h1>
              <p className="text-sm text-muted-foreground">Schiphol Buitenveldertbaan Monitor</p>
            </div>

            {/* Top-level navigation */}
            <nav className="flex gap-1" role="tablist" aria-label="Main navigation">
              {TOP_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={topTab === tab.id}
                  onClick={() => setTopTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    topTab === tab.id
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <InstallPrompt />
            <ThemeSwitcher />
          </div>
        </div>

      </header>

      {/* Dashboard content */}
      {topTab === 'dashboard' && (
        <>
          {/* Status cards */}
          <StatusBanner
            state={state}
            connected={connected}
            onEnableNotifications={requestNotificationPermission}
          />

          <main className="flex flex-1 flex-col gap-5 px-6 pb-6">
                {/* Top section: Live Map (1/3, spans 2 rows) | Tables (2/3) */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {/* Live Map — spans 2 grid rows */}
                  <div className="rounded-xl border bg-card shadow-sm lg:row-span-2">
                    <div className="border-b px-5 py-3">
                      <h2 className="text-sm font-semibold">Live Map</h2>
                    </div>
                    <div className="h-[700px] p-1">
                      <FlightMap state={state} />
                    </div>
                  </div>
                  {/* Right column row 1: Aircraft Visible + In Cone */}
                  {zone && (
                    <ConeFlightsTable
                      flights={zoneFlights}
                      title="Aircraft Visible"
                      emptyLabel="No aircraft currently inside the zone"
                    />
                  )}
                  <ConeFlightsTable flights={state.approachingFlights} />
                  {/* Right column row 2: Airborne Flights (spans 2 cols) */}
                  <div className="lg:col-span-2 rounded-xl border bg-card shadow-sm">
                    <div className="border-b px-5 py-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold">Airborne Flights</h2>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {state.allFlights.filter((f) => !f.onGround).length}
                      </span>
                    </div>
                    <FlightList flights={state.allFlights} approachingIds={approachingIds} />
                  </div>
                </div>

                {/* Bottom row: Scheduled Arrivals (50%) | Weather (50%) */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <ScheduledArrivalsTable />
                  <WeatherCard weather={state.weather ?? null} />
                </div>
          </main>
        </>
      )}

      {topTab === 'predictions' && (
        <main className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Predictions Inputs</h2>
            <p className="text-sm text-muted-foreground">
              Live cone traffic and scheduled arrivals to Amsterdam, with historical paths per scheduled flight
            </p>
          </div>
          {zone && (
            <ConeFlightsTable
              flights={zoneFlights}
              title="Aircraft Visible"
              emptyLabel="No aircraft currently inside the zone"
            />
          )}
          <ConeFlightsTable flights={state.approachingFlights} />
          <ScheduledArrivalsTable />
        </main>
      )}

      {/* Spotting content */}
      {topTab === 'spotting' && (
        <main className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Aircraft Spotting Quiz</h2>
            <p className="text-sm text-muted-foreground">Test your aircraft identification skills</p>
          </div>
          <SpottingQuiz />
        </main>
      )}

      {/* Settings content */}
      {topTab === 'settings' && (
        <main className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            <p className="text-sm text-muted-foreground">Manage your notification and detection preferences</p>
          </div>
          <SettingsPage />
        </main>
      )}
    </div>
  );
}
