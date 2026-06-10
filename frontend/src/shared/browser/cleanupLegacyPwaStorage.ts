const cleanupMarkerKey = 'goods-accounting:legacy-pwa-cleanup:v1';

const cachePrefixes = ['workbox-', 'goods-accounting-'];
const cacheFragments = ['dev-dist', 'dev-sw'];

const clearLegacyCaches = async () => {
  if (typeof caches === 'undefined') return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cachePrefixes.some((prefix) => cacheName.startsWith(prefix)) ||
          cacheFragments.some((fragment) => cacheName.includes(fragment)),
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
};

const unregisterServiceWorkers = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

export const cleanupLegacyPwaStorageOnce = () => {
  if (typeof window === 'undefined') return;

  if (window.localStorage.getItem(cleanupMarkerKey) === 'done') {
    return;
  }

  void Promise.all([unregisterServiceWorkers(), clearLegacyCaches()]).finally(() => {
    window.localStorage.setItem(cleanupMarkerKey, 'done');
  });
};
