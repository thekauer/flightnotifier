'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { NotificationZoneProvider } from '@/lib/notificationZoneContext';
import { DataSourceProvider } from '@/lib/dataSourceContext';
import { VisibilitySettingsProvider } from '@/lib/visibilitySettingsContext';
import { PredictionHorizonProvider } from '@/lib/predictionHorizonContext';
import { AircraftFilterProvider } from '@/lib/aircraftFilterContext';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <NotificationZoneProvider>
          <VisibilitySettingsProvider>
            <PredictionHorizonProvider>
              <AircraftFilterProvider>{children}</AircraftFilterProvider>
            </PredictionHorizonProvider>
          </VisibilitySettingsProvider>
        </NotificationZoneProvider>
      </DataSourceProvider>
    </QueryClientProvider>
  );
}
