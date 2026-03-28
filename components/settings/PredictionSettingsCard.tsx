'use client';

import { useVisibilitySettings } from '@/lib/visibilitySettingsContext';

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}

export function PredictionSettingsCard() {
  const { settings, updateSetting } = useVisibilitySettings();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Visibility Predictions</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Predict when approaching aircraft will enter your notification zone
        </p>
      </div>
      <div className="px-5 py-4 space-y-4">
        <Toggle
          checked={settings.predictionEnabled}
          onChange={(v) => updateSetting('predictionEnabled', v)}
          label="Enable predictions"
          description="Show countdown timers for aircraft approaching your zone"
        />
        <Toggle
          checked={settings.notifyPartialVisibility}
          onChange={(v) => updateSetting('notifyPartialVisibility', v)}
          label="Notify in low visibility"
          description="Send notifications even when weather conditions are marginal"
        />
        <Toggle
          checked={settings.notifyObscured}
          onChange={(v) => updateSetting('notifyObscured', v)}
          label="Notify when obscured"
          description="Send notifications even when aircraft will be above clouds"
        />
        <Toggle
          checked={settings.soundEnabled}
          onChange={(v) => updateSetting('soundEnabled', v)}
          label="Sound"
          description="Play a sound with prediction notifications"
        />
      </div>
    </div>
  );
}
