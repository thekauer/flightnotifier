'use client';

import { AircraftTypeFilter } from './settings/AircraftTypeFilter';
import { PredictionSettingsCard } from './settings/PredictionSettingsCard';
import { PredictionHorizonCard } from './settings/PredictionHorizonCard';
import { SpottingModeCard } from './settings/SpottingModeCard';
import { StaggerCard } from './settings/StaggerCard';

export function SettingsPage() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Notifications */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure browser push notifications for runway activity
          </p>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm text-muted-foreground">
          <p>Notification settings will be available here.</p>
        </div>
      </div>

      {/* Detection */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Detection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tune the Buitenveldertbaan approach detection parameters
          </p>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm text-muted-foreground">
          <p>Detection settings will be available here.</p>
        </div>
      </div>

      {/* Runway Prediction Horizon */}
      <PredictionHorizonCard />

      {/* Visibility Predictions */}
      <PredictionSettingsCard />

      {/* Aircraft Type Filter */}
      <AircraftTypeFilter />

      {/* Spotting Mode */}
      <SpottingModeCard />

      {/* Staggered Animations */}
      <StaggerCard />

      {/* Display */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="text-sm font-semibold">Display</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Map appearance, table layout, and theme preferences
          </p>
        </div>
        <div className="px-5 py-4 space-y-4 text-sm text-muted-foreground">
          <p>Display settings will be available here.</p>
        </div>
      </div>
    </div>
  );
}
