'use client';

const DEFAULT_NOTIFICATION_ICON = '/icon.svg';

export interface AppNotificationOptions extends NotificationOptions {
  requireInteraction?: boolean;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') {
    return 'denied';
  }

  if (Notification.permission !== 'default') {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

export async function showAppNotification(
  title: string,
  options: AppNotificationOptions = {},
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return false;
  }

  const permission = await requestBrowserNotificationPermission();
  if (permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    icon: DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_ICON,
    ...options,
  };

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, notificationOptions);
      return true;
    } catch {
      // Fall back to the page-level Notification API if the service worker path fails.
    }
  }

  try {
    new Notification(title, notificationOptions);
    return true;
  } catch {
    return false;
  }
}
