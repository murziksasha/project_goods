import type React from 'react';
import { DashboardPage } from '../pages/dashboard';
import { AppErrorBoundary } from './AppErrorBoundary';

const App = () => (
export const App: React.FC = () => (
  <AppErrorBoundary>
    <DashboardPage />
  </AppErrorBoundary>
);

export default App;
