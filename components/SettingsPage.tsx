'use client';

import { AircraftTypeFilter } from './settings/AircraftTypeFilter';
import { PredictionSettingsCard } from './settings/PredictionSettingsCard';
import { PredictionHorizonCard } from './settings/PredictionHorizonCard';
import { SpottingModeCard } from './settings/SpottingModeCard';
import { StaggerCard } from './settings/StaggerCard';
import { EtaFormatCard } from './settings/EtaFormatCard';
import { AnimateCard } from './settings/AnimateCard';
import { TestNotificationCard } from './settings/TestNotificationCard';

export function SettingsPage() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <PredictionHorizonCard />
      <PredictionSettingsCard />
      <AircraftTypeFilter />
      <SpottingModeCard />
      <AnimateCard />
      <StaggerCard />
      <EtaFormatCard />
      <TestNotificationCard />
    </div>
  );
}
