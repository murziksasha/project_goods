import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import i18n from './shared/i18n/config'
import App from './app/App.tsx'
import { queryClient } from './shared/api/queryClient.ts'
import { cleanupLegacyPwaStorageOnce } from './shared/browser/cleanupLegacyPwaStorage.ts'
import {
  applyUiDensity,
  readUiDensity,
} from './shared/lib/uiDensity.ts'
import { applyUiTheme, readUiTheme } from './shared/lib/uiTheme.ts'

cleanupLegacyPwaStorageOnce();
applyUiDensity(readUiDensity());
applyUiTheme(readUiTheme());

const rootElement = document.getElementById('root');

const renderApp = () => {
  if (!rootElement) return;

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
};

if (i18n.isInitialized) {
  renderApp();
} else {
  i18n.on('initialized', renderApp);
}
