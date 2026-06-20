import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './shared/i18n/config'
import App from './app/App.tsx'
import { queryClient } from './shared/api/queryClient.ts'
import { cleanupLegacyPwaStorageOnce } from './shared/browser/cleanupLegacyPwaStorage.ts'

cleanupLegacyPwaStorageOnce();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
