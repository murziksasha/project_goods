import { DashboardPage } from '../pages/dashboard/ui/DashboardPage';
import { PwaInstallPrompt } from '../shared/pwa/PwaInstallPrompt';
import { PwaUpdatePrompt } from '../shared/pwa/PwaUpdatePrompt';

const App = () => (
  <>
    <DashboardPage />
    <PwaInstallPrompt />
    <PwaUpdatePrompt />
  </>
);

export default App;
