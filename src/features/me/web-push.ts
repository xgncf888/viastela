import { Platform } from 'react-native';

import { vapidPublicKey } from '@/config/env';

import type { ReminderPermission } from '@/core/reminder-settings';

export type BrowserEnv = {
  vapidConfigured: boolean;
  ios: boolean;
  standalone: boolean;
  pushSupported: boolean;
  permission: ReminderPermission;
};

type PushSubscriptionJson = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

type PushSubscriptionLike = {
  endpoint: string;
  toJSON: () => PushSubscriptionJson;
};

type PushManagerLike = {
  getSubscription: () => Promise<PushSubscriptionLike | null>;
  subscribe: (options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => Promise<PushSubscriptionLike>;
};

type BrowserNotification = {
  permission: string;
  requestPermission: () => Promise<string>;
};

type BrowserWindow = Window & {
  standalone?: boolean;
  Notification?: BrowserNotification;
};

function browserWindow(): BrowserWindow | null {
  // React Native provides `window` without `matchMedia`. The platform check is the guard.
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return window;
}

export function readVapidPublicKey(): string | null {
  return vapidPublicKey();
}

export function browserIsIos(): boolean {
  const nav = browserWindow()?.navigator;
  if (!nav || typeof nav.userAgent !== 'string') return false;
  const platform = typeof nav.platform === 'string' ? nav.platform : '';
  const points = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0;
  return /iPad|iPhone|iPod/i.test(nav.userAgent) || (platform === 'MacIntel' && points > 1);
}

export function browserStandalone(): boolean {
  const view = browserWindow();
  if (!view || typeof view.matchMedia !== 'function') return false;
  const nav = view.navigator as (Navigator & { standalone?: boolean }) | undefined;
  return view.matchMedia('(display-mode: standalone)').matches || nav?.standalone === true;
}

export function browserPushSupported(): boolean {
  const view = browserWindow();
  const nav = view?.navigator;
  if (!view || !nav || typeof nav.serviceWorker === 'undefined') return false;
  return typeof (view as BrowserWindow & { PushManager?: unknown }).PushManager !== 'undefined';
}

export function browserPermission(): ReminderPermission {
  const view = browserWindow();
  if (!view || typeof view.Notification === 'undefined') return 'unsupported';
  const value = view.Notification.permission;
  if (value === 'granted' || value === 'denied' || value === 'default') return value;
  return 'unsupported';
}

export function readBrowserEnv(): BrowserEnv {
  return {
    vapidConfigured: Boolean(readVapidPublicKey()),
    ios: browserIsIos(),
    standalone: browserStandalone(),
    pushSupported: browserPushSupported(),
    permission: browserPermission(),
  };
}

export async function requestBrowserPermission(): Promise<ReminderPermission> {
  const view = browserWindow();
  if (!view || typeof view.Notification?.requestPermission !== 'function') return 'unsupported';
  const value = await view.Notification.requestPermission();
  if (value === 'granted' || value === 'denied' || value === 'default') return value;
  return 'unsupported';
}

export function urlBase64ToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function pushManager(): Promise<PushManagerLike | null> {
  const view = browserWindow();
  if (!view || typeof view.navigator?.serviceWorker === 'undefined') return null;
  const registration = await view.navigator.serviceWorker.ready;
  const manager = (registration as ServiceWorkerRegistration & { pushManager?: PushManagerLike }).pushManager;
  return manager ?? null;
}

export async function currentEndpoint(): Promise<string | null> {
  try {
    const manager = await pushManager();
    const subscription = await manager?.getSubscription();
    return subscription?.endpoint ?? null;
  } catch {
    return null;
  }
}

export async function subscribePush(vapidPublic: string): Promise<{ endpoint: string; p256dh: string; auth: string }> {
  const manager = await pushManager();
  if (!manager) throw new Error('push unsupported');
  const existing = await manager.getSubscription();
  const subscription =
    existing ??
    (await manager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(vapidPublic),
    }));
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error('push keys missing');
  return { endpoint, p256dh, auth };
}
