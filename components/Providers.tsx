'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { NotificationZoneProvider } from '@/lib/notificationZoneContext';
import { VisibilitySettingsProvider } from '@/lib/visibilitySettingsContext';
import { PredictionHorizonProvider } from '@/lib/predictionHorizonContext';
import { AircraftFilterProvider } from '@/lib/aircraftFilterContext';
import { SpottingModeProvider } from '@/lib/spottingModeContext';
import { StaggerProvider } from '@/lib/staggerContext';
import { SelectedFlightProvider } from '@/lib/selectedFlightContext';
import { EtaFormatProvider } from '@/lib/etaFormatContext';
import { AnimateProvider } from '@/lib/animateContext';
import { FlightEventsProvider } from '@/lib/flightEventsContext';
import { AirportActivityBridge } from '@/components/AirportActivityBridge';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const enableLiveShell = pathname !== '/component';

  const content = enableLiveShell ? <FlightEventsProvider>{children}</FlightEventsProvider> : <>{children}</>;

  return (
    <QueryClientProvider client={queryClient}>
      {enableLiveShell ? <AirportActivityBridge /> : null}
      <SpottingModeProvider>
        <StaggerProvider>
          <NotificationZoneProvider>
            <VisibilitySettingsProvider>
              <PredictionHorizonProvider>
                <AircraftFilterProvider>
                  <EtaFormatProvider>
                    <AnimateProvider>
                      <SelectedFlightProvider>
                        {content}
                      </SelectedFlightProvider>
                    </AnimateProvider>
                  </EtaFormatProvider>
                </AircraftFilterProvider>
              </PredictionHorizonProvider>
            </VisibilitySettingsProvider>
          </NotificationZoneProvider>
        </StaggerProvider>
      </SpottingModeProvider>
    </QueryClientProvider>
  );
}
