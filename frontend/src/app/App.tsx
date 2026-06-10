import { DashboardPage } from '../pages/dashboard/ui/DashboardPage';
import { AppErrorBoundary } from './AppErrorBoundary';

const App = () => (
  <AppErrorBoundary>
    <DashboardPage />
  </AppErrorBoundary>
);

export default App;
