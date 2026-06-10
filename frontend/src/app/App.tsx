import { DashboardPage } from '../pages/dashboard/ui/DashboardPage';
import { PwaInstallPrompt } from '../shared/pwa/PwaInstallPrompt';
import { PwaUpdatePrompt } from '../shared/pwa/PwaUpdatePrompt';
import { AppErrorBoundary } from './AppErrorBoundary';

const App = () => (
  <AppErrorBoundary>
    <DashboardPage />
    <PwaInstallPrompt />
    <PwaUpdatePrompt />
  </AppErrorBoundary>
);

export default App;
