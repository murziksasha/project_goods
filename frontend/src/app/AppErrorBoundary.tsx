import { Component, type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

const clearBrowserCaches = async () => {
  if (typeof caches === 'undefined') return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          cacheName.startsWith('workbox-') ||
          cacheName.startsWith('goods-accounting-'),
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

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed:', error, info);
  }

  private reloadApp = async () => {
    await unregisterServiceWorkers();
    await clearBrowserCaches();
    const url = new URL(window.location.href);
    url.searchParams.set('refresh', String(Date.now()));
    window.location.replace(url.toString());
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">Recovery</p>
                  <h2>Application needs a refresh</h2>
                </div>
              </div>
              <p className="empty-state">
                The app stayed on an outdated or broken screen. Refresh will
                clear cached files and open the workspace again.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => void this.reloadApp()}
              >
                Refresh app
              </button>
            </section>
          </div>
        </section>
      </main>
    );
  }
}
