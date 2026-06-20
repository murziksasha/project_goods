import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../shared/i18n/config';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

const isDevelopment = import.meta.env.DEV;
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
                  <p className="section-label">{i18n.t('app.errorBoundary.recovery')}</p>
                  <h2>{i18n.t('app.errorBoundary.title')}</h2>
                </div>
              </div>
              <p className="empty-state">{i18n.t('app.errorBoundary.message')}</p>
              {isDevelopment && this.state.error.message ? (
                <p className="empty-state">
                  {i18n.t('app.errorBoundary.errorPrefix')} {this.state.error.message}
                </p>
              ) : null}
              <button
                type="button"
                className="primary-button"
                onClick={() => void this.reloadApp()}
              >
                {i18n.t('app.errorBoundary.refreshApp')}
              </button>
            </section>
          </div>
        </section>
      </main>
    );
  }
}