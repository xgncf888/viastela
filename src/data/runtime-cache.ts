/**
 * Drops the service worker's Cache Storage after sign-out.
 * The worker only stores the static shell, and this still runs so the next
 * person on the device cannot be served a previous runtime entry.
 */
export async function clearServiceWorkerRuntimeCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => tellWorkerToClear(registration)));
    }
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {
    // The session is already gone. A cache miss must not surface as a failed sign-out.
  }
}

function tellWorkerToClear(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.active;
  if (!worker) return Promise.resolve();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(resolve, 1000);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      worker.postMessage({ type: 'CLEAR_RUNTIME_CACHE' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}
