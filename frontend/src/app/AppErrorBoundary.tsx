import { Component, type ErrorInfo, type ReactNode } from 'react';
import { hardReloadApp } from '../shared/lib/hardReload';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

const isDevelopment = import.meta.env.DEV;

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
    await hardReloadApp();
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
              {isDevelopment && this.state.error.message ? (
                <p className="empty-state">
                  Error: {this.state.error.message}
                </p>
              ) : null}
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
