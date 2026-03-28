'use client';

import { useStagger } from '@/lib/staggerContext';

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

export function StaggerCard() {
  const { staggerEnabled, setStaggerEnabled, staggerMaxDelayMs, setStaggerMaxDelayMs } = useStagger();
  const delaySec = Math.round(staggerMaxDelayMs / 1000);

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Staggered Animations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          When enabled, table values update with slight random delays for a more organic, departure-board feel.
        </p>
      </div>
      <div className="px-5 py-4 space-y-4">
        <Toggle
          checked={staggerEnabled}
          onChange={setStaggerEnabled}
          label="Enable staggered updates"
          description="Each numeric cell updates with a random delay after new data arrives"
        />
        {staggerEnabled && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Max delay</span>
              <span className="text-xs font-bold tabular-nums">{delaySec}s</span>
            </div>
            <input
              type="range"
              min={1000}
              max={15000}
              step={1000}
              value={staggerMaxDelayMs}
              onChange={(e) => setStaggerMaxDelayMs(parseInt(e.target.value, 10))}
              className="w-full accent-blue-600 h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1s</span>
              <span>15s</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
