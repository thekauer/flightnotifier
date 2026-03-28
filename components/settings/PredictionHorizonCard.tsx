'use client';

import { useState } from 'react';
import {
  usePredictionHorizon,
  MIN_HORIZON,
  MAX_HORIZON,
  DEFAULT_HORIZON,
} from '@/lib/predictionHorizonContext';

export function PredictionHorizonCard() {
  const { horizonMinutes, setHorizonMinutes } = usePredictionHorizon();
  const [inputValue, setInputValue] = useState(String(horizonMinutes));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < MIN_HORIZON || parsed > MAX_HORIZON) {
      setInputValue(String(horizonMinutes));
      return;
    }
    setHorizonMinutes(parsed);
    setInputValue(String(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleReset = () => {
    setHorizonMinutes(DEFAULT_HORIZON);
    setInputValue(String(DEFAULT_HORIZON));
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Prediction Horizon</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          How far ahead to show runway predictions for arriving flights
        </p>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="horizon-input" className="text-sm text-muted-foreground whitespace-nowrap">
            Horizon
          </label>
          <input
            id="horizon-input"
            type="number"
            min={MIN_HORIZON}
            max={MAX_HORIZON}
            step={1}
            value={inputValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-20 rounded-md border bg-background px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">minutes</span>
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset to {DEFAULT_HORIZON}min
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Range: {MIN_HORIZON} to {MAX_HORIZON} minutes ({Math.floor(MAX_HORIZON / 60)} hours).
          Flights with an ETA beyond this horizon will not show runway predictions.
        </p>
      </div>
    </div>
  );
}
