'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationZoneProvider } from '@/lib/notificationZoneContext';
import { VisibilitySettingsProvider } from '@/lib/visibilitySettingsContext';
import { PredictionHorizonProvider } from '@/lib/predictionHorizonContext';
import { AircraftFilterProvider } from '@/lib/aircraftFilterContext';
import { SpottingModeProvider } from '@/lib/spottingModeContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SpottingModeProvider>
        <NotificationZoneProvider>
          <VisibilitySettingsProvider>
            <PredictionHorizonProvider>
              <AircraftFilterProvider>{children}</AircraftFilterProvider>
            </PredictionHorizonProvider>
          </VisibilitySettingsProvider>
        </NotificationZoneProvider>
      </SpottingModeProvider>
    </QueryClientProvider>
  );
}
