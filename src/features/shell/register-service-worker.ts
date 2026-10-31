import { Platform } from 'react-native';

/**
 * Registers the static-shell worker in production web builds.
 * An automatic install banner is suppressed. The settings page explains the gesture instead.
 * A worker that replaces an already-controlling worker reloads once so the new bundle is used.
 */
let registered = false;

export function registerServiceWorker(): void {
  if (registered) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return;
  if (!('serviceWorker' in navigator)) return;
  registered = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
  });

  const hadController = Boolean(navigator.serviceWorker.controller);
  void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((registration) => {
    void registration.update();
  });

  if (!hadController) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}
