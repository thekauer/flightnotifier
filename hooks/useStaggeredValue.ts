'use client';

import { useEffect, useRef, useState } from 'react';
import { useStagger } from '@/lib/staggerContext';

/**
 * Returns `value` with a per-instance random delay when stagger mode is enabled.
 * Each hook instance picks a stable random fraction on mount; the actual delay
 * is fraction * staggerMaxDelayMs from the context (so the slider adjusts live).
 * When disabled, returns the raw value immediately.
 */
export function useStaggeredValue(value: number, _maxDelayMs?: number): number {
  const { staggerEnabled, staggerMaxDelayMs } = useStagger();
  const fractionRef = useRef(Math.random());
  const delayRef = useRef(fractionRef.current * staggerMaxDelayMs);
  const [displayedValue, setDisplayedValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevValueRef = useRef(value);
  const isFirstRenderRef = useRef(true);

  // Update delay when max changes (slider adjustment)
  delayRef.current = fractionRef.current * staggerMaxDelayMs;

  // useEffect for setTimeout cleanup (timer management) — must always be called
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!staggerEnabled) {
    // Clear any pending timer and return raw value.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    prevValueRef.current = value;
    isFirstRenderRef.current = false;
    if (displayedValue !== value) {
      setDisplayedValue(value);
    }
    return value;
  }

  // On first render with stagger enabled, return value immediately (no delay).
  if (isFirstRenderRef.current) {
    isFirstRenderRef.current = false;
    prevValueRef.current = value;
    if (displayedValue !== value) {
      setDisplayedValue(value);
    }
    return value;
  }

  // When value changes, schedule a delayed update.
  if (value !== prevValueRef.current) {
    prevValueRef.current = value;

    // Cancel any pending timer and restart with new value.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDisplayedValue(value);
    }, delayRef.current);
  }

  return displayedValue;
}
