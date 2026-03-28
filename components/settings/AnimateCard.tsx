'use client';

import { useAnimate } from '@/lib/animateContext';

export function AnimateCard() {
  const { animateEnabled, setAnimateEnabled } = useAnimate();

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Animate Aircraft</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Smoothly interpolate aircraft positions between updates
        </p>
      </div>
      <div className="px-5 py-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={animateEnabled}
            onClick={() => setAnimateEnabled(!animateEnabled)}
            className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              animateEnabled ? 'bg-blue-600' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                animateEnabled ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-medium">Enable animation</div>
            <div className="text-xs text-muted-foreground">Aircraft move smoothly on the map between 90-second updates</div>
          </div>
        </label>
      </div>
    </div>
  );
}
