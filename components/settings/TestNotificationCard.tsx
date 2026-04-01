'use client';

import { useState } from 'react';

export function TestNotificationCard() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'denied' | 'unsupported'>('idle');

  const sendTestNotification = () => {
    if (typeof Notification === 'undefined') {
      setStatus('unsupported');
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('Flight Notifier Test', {
        body: 'Notifications are working correctly!',
        icon: '/favicon.ico',
      });
      setStatus('sent');
      return;
    }

    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('Flight Notifier Test', {
          body: 'Notifications are working correctly!',
          icon: '/favicon.ico',
        });
        setStatus('sent');
      } else {
        setStatus('denied');
      }
    });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Test Notification</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Send a test notification to verify your browser settings
        </p>
      </div>
      <div className="px-5 py-4 flex items-center gap-3">
        <button
          onClick={sendTestNotification}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Send Test
        </button>
        {status === 'sent' && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Notification sent!</span>
        )}
        {status === 'denied' && (
          <span className="text-xs text-red-600 dark:text-red-400">
            Notifications blocked. Check your browser settings.
          </span>
        )}
        {status === 'unsupported' && (
          <span className="text-xs text-muted-foreground">
            Notifications not supported in this browser.
          </span>
        )}
      </div>
    </div>
  );
}
