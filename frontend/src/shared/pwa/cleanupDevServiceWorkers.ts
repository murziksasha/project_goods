export const cleanupDevServiceWorkers = () => {
  if (!import.meta.env.DEV || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      const scriptUrl =
        registration.active?.scriptURL ??
        registration.installing?.scriptURL ??
        registration.waiting?.scriptURL ??
        '';

      if (scriptUrl.includes('dev-sw.js') || scriptUrl.includes('/dev-dist/')) {
        void registration.unregister();
      }
    });
  });
};
