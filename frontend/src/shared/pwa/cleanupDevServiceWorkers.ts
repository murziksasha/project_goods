export const cleanupDevServiceWorkers = () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      const scriptUrl =
        registration.active?.scriptURL ??
        registration.installing?.scriptURL ??
        registration.waiting?.scriptURL ??
        '';

      if (
        scriptUrl.includes('dev-sw.js') ||
        scriptUrl.includes('/dev-dist/')
      ) {
        void registration.unregister();
      }
    });
  });

  if (typeof caches === 'undefined') {
    return;
  }

  void caches.keys().then((cacheNames) => {
    cacheNames.forEach((cacheName) => {
      if (cacheName.includes('dev-dist') || cacheName.includes('dev-sw')) {
        void caches.delete(cacheName);
      }
    });
  });
};
