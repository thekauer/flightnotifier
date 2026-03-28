'use client';

import { useSpottingMode } from '@/lib/spottingModeContext';

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

export function SpottingModeCard() {
  const { spottingModeEnabled, setSpottingModeEnabled } = useSpottingMode();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Spotting Mode</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Hide aircraft types until you guess them from multiple-choice options
        </p>
      </div>
      <div className="px-5 py-4 space-y-4">
        <Toggle
          checked={spottingModeEnabled}
          onChange={setSpottingModeEnabled}
          label="Enable spotting mode"
          description="Aircraft type badges turn into quiz badges with a question mark until you answer"
        />
      </div>
    </div>
  );
}
