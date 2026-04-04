'use client';

import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { OnboardingPageContent } from '@/components/onboarding/OnboardingPageContent';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';

export default function HomePage() {
  const hasHydrated = useSelectedAirportsStore((state) => state.hasHydrated);
  const hasSelectedAirport = useSelectedAirportsStore((state) => state.selectedAirports.length > 0);
  const hasCompletedOnboarding = useSelectedAirportsStore((state) => state.hasCompletedOnboarding);

  if (!hasHydrated) {
    return (
      <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
        <div className="rounded-3xl border bg-card px-6 py-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Loading</p>
          <p className="mt-2 text-sm text-muted-foreground">Checking your saved airport selection...</p>
        </div>
      </main>
    );
  }

  if (!hasSelectedAirport || !hasCompletedOnboarding) {
    return <OnboardingPageContent />;
  }

  return <DashboardContent />;
}
