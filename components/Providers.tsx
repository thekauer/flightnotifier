'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationZoneProvider } from '@/lib/notificationZoneContext';
import { VisibilitySettingsProvider } from '@/lib/visibilitySettingsContext';
import { PredictionHorizonProvider } from '@/lib/predictionHorizonContext';
import { AircraftFilterProvider } from '@/lib/aircraftFilterContext';
import { SpottingModeProvider } from '@/lib/spottingModeContext';
import { StaggerProvider } from '@/lib/staggerContext';
import { SelectedFlightProvider } from '@/lib/selectedFlightContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SpottingModeProvider>
        <StaggerProvider>
          <NotificationZoneProvider>
            <VisibilitySettingsProvider>
              <PredictionHorizonProvider>
                <AircraftFilterProvider>
                  <SelectedFlightProvider>{children}</SelectedFlightProvider>
                </AircraftFilterProvider>
              </PredictionHorizonProvider>
            </VisibilitySettingsProvider>
          </NotificationZoneProvider>
        </StaggerProvider>
      </SpottingModeProvider>
    </QueryClientProvider>
  );
}
