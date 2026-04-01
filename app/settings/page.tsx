'use client';

import { SettingsPage } from '@/components/SettingsPage';

export default function SettingsRoute() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-6 py-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your notification and detection preferences</p>
      </div>
      <SettingsPage />
    </main>
  );
}
