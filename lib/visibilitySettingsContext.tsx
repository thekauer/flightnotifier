'use client';

import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';

export interface VisibilitySettings {
  predictionEnabled: boolean;
  notifyPartialVisibility: boolean;
  notifyObscured: boolean;
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: VisibilitySettings = {
  predictionEnabled: true,
  notifyPartialVisibility: true,
  notifyObscured: false,
  soundEnabled: false,
};

interface VisibilitySettingsContextValue {
  settings: VisibilitySettings;
  updateSetting: <K extends keyof VisibilitySettings>(key: K, value: VisibilitySettings[K]) => void;
}

const VisibilitySettingsContext = createContext<VisibilitySettingsContextValue | null>(null);

export function VisibilitySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<VisibilitySettings>(DEFAULT_SETTINGS);

  const updateSetting = useCallback(
    <K extends keyof VisibilitySettings>(key: K, value: VisibilitySettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <VisibilitySettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </VisibilitySettingsContext.Provider>
  );
}

export function useVisibilitySettings(): VisibilitySettingsContextValue {
  const ctx = useContext(VisibilitySettingsContext);
  if (!ctx) {
    throw new Error('useVisibilitySettings must be used within VisibilitySettingsProvider');
  }
  return ctx;
}
