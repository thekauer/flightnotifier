'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Reads the deferred install prompt from the global variable set by the
 * inline script in layout.tsx. Uses useSyncExternalStore so the component
 * re-renders when the prompt becomes available — no useEffect needed.
 */

// Tiny external store that wraps window.__pwaPrompt
let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return (window as any).__pwaPrompt ?? null;
}

function getServerSnapshot(): BeforeInstallPromptEvent | null {
  return null;
}

// Called from the inline script in layout.tsx whenever beforeinstallprompt fires
if (typeof window !== 'undefined') {
  (window as any).__pwaPromptNotify = () => {
    listeners.forEach((l) => l());
  };
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const deferredPrompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).__pwaPrompt = null;
      (window as any).__pwaPromptNotify?.();
    }
  }, [deferredPrompt]);

  if (!deferredPrompt) return null;

  return (
    <button
      onClick={handleInstall}
      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      Install App
    </button>
  );
}
