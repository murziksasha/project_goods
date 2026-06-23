const cacheFragments = ['dev-dist', 'dev-sw'];

const clearBrowserCaches = async () => {
  if (typeof caches === 'undefined') return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith('workbox-') ||
          cacheName.startsWith('goods-accounting-') ||
          cacheFragments.some((fragment) => cacheName.includes(fragment)),
      )
      .map((cacheName) => caches.delete(cacheName)),
  );
};

const unregisterServiceWorkers = async () => {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
};

export const hardReloadApp = async () => {
  await unregisterServiceWorkers();
  await clearBrowserCaches();
  const url = new URL(window.location.href);
  url.searchParams.set('refresh', String(Date.now()));
  window.location.replace(url.toString());
};