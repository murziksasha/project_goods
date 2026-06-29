import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../../../entities/auth/api/authApi';
import { ApiRequestError } from '../../../shared/api/http';
import type { Employee } from '../../../entities/employee/model/types';
import { authTokenStorageKey } from '../../../entities/auth/api/authApi';


const { getCurrentEmployeeMock } = vi.hoisted(() => ({
  getCurrentEmployeeMock: vi.fn(),
}));

vi.mock('../../../entities/auth/api/authApi', async () => {
  const actual = await vi.importActual<typeof import('../../../entities/auth/api/authApi')>(
    '../../../entities/auth/api/authApi',
  );
  return {
    ...actual,
    getCurrentEmployee: getCurrentEmployeeMock,
    getInvitationDetails: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
});

vi.mock('../model/use-dashboard-effects', () => ({
  useDashboardEffects: vi.fn(),
}));

vi.mock('../model/useDashboardPage', () =>
  import('../model/__mocks__/useDashboardPage'),
);

vi.mock('../../../widgets/dashboard/ui/shared/Notifications', () => ({
  Notifications: ({ error }: { error: string }) => (
    <div data-testid="notifications">{error}</div>
  ),
}));
vi.mock('../../../widgets/dashboard/ui/analytics/AnalyticsHeroSection', () => ({
  AnalyticsHeroSection: () => <section>Dashboard home</section>,
}));
vi.mock('../../../widgets/dashboard/ui/weather/MarketWeatherWidget', () => ({
  MarketWeatherWidget: () => null,
}));
vi.mock('../../../widgets/dashboard/ui/orders/workspace/OrdersWorkspace', () => ({
  OrdersWorkspace: () => <section>Orders workspace</section>,
}));
vi.mock('../../../widgets/dashboard/ui/orders/create-order/CreateOrderCard', () => ({
  CreateOrderCard: () => <section>Create order</section>,
}));
vi.mock('../../../widgets/dashboard/ui/settings/EmployeeManagementPanel', () => ({
  EmployeeManagementPanel: () => <section>Employees</section>,
}));
vi.mock('../../../widgets/dashboard/ui/settings/SettingsPanel', () => ({
  SettingsPanel: () => <section>Settings</section>,
}));
vi.mock('../../../widgets/dashboard/ui/accounting/AccountingPanel', () => ({
  AccountingPanel: () => <section>Accounting</section>,
}));
vi.mock('../../../widgets/dashboard/ui/product-catalog/ProductCatalogPanel', () => ({
  ProductCatalogPanel: () => <section>Catalog</section>,
}));
vi.mock('../../../widgets/dashboard/ui/warehouse/WarehousePanel', () => ({
  WarehousePanel: () => <section>Warehouse</section>,
}));
vi.mock('../../../widgets/dashboard/ui/clients/ClientsSuppliersWorkspace', () => ({
  ClientsSuppliersWorkspace: () => <section>Clients</section>,
}));
vi.mock('../../../widgets/dashboard/ui/supplier-orders/SupplierOrdersWorkspace', () => ({
  SupplierOrdersWorkspace: () => <section>Supplier orders</section>,
}));
vi.mock('../../../shared/ui/GlobalHorizontalScrollbar', () => ({
  GlobalHorizontalScrollbar: () => null,
}));

const hardReloadAppMock = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/lib/hardReload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/lib/hardReload')>();
  return { ...actual };
});

import type { DashboardPage as DashboardPageComponent } from './DashboardPage';
import * as hardReload from '../../../shared/lib/hardReload';
import * as useDashboardPageModule from '../model/useDashboardPage';
import { useDashboardPage as useDashboardPageMockImpl } from '../model/__mocks__/useDashboardPage';

let DashboardPage: typeof DashboardPageComponent;

const employee: Employee = {
  id: 'employee-id',
  name: 'Manager',
  phone: '',
  email: '',
  username: 'manager',
  role: 'manager',
  permissions: ['orders.view'],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-06-09T00:00:00.000Z',
  updatedAt: '2026-06-09T00:00:00.000Z',
};

const restoreAuthMock = () => {
  vi.spyOn(authApi, 'getCurrentEmployee').mockImplementation(() => getCurrentEmployeeMock());
};

beforeEach(async () => {
  vi.restoreAllMocks();
  getCurrentEmployeeMock.mockReset();
  hardReloadAppMock.mockReset();
  getCurrentEmployeeMock.mockResolvedValue(employee);
  restoreAuthMock();
  vi.spyOn(useDashboardPageModule, 'useDashboardPage').mockImplementation(
    useDashboardPageMockImpl as unknown as typeof useDashboardPageModule.useDashboardPage,
  );
  vi.spyOn(hardReload, 'hardReloadApp').mockImplementation(hardReloadAppMock);
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value: true,
  });
  ({ DashboardPage } = await import('./DashboardPage'));
});

const renderDashboardPage = (ui: ReactElement = <DashboardPage />) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('DashboardPage sync control', () => {
  it('hard reloads the app when Last sync is clicked', async () => {
    getCurrentEmployeeMock.mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'valid-token');

    renderDashboardPage();

    const syncButton = await screen.findByRole('button', { name: /Last sync/i });
    fireEvent.click(syncButton);
    expect(hardReloadAppMock).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardPage auth recovery', () => {
  it('keeps the workspace open when session check returns 401 and a snapshot exists', async () => {
    getCurrentEmployeeMock.mockRejectedValue(
      new ApiRequestError('Session not found.', {
        hasResponse: true,
        status: 401,
      }),
    );
    window.localStorage.setItem(authTokenStorageKey, 'stale-token');
    window.localStorage.setItem(
      'project-goods.employee-snapshot',
      JSON.stringify(employee),
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Business performance')).toBeInTheDocument();
    });

    expect(screen.queryByText('Sign in')).not.toBeInTheDocument();
    expect(screen.queryByText('Session not found.')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Session check failed/i)).toBeInTheDocument();
    });
  });
});

describe('DashboardPage browser history', () => {
  it('pushes history entries for in-app navigation and restores state on popstate', async () => {
    const pushState = vi
      .spyOn(window.history, 'pushState')
      .mockImplementation((_data, _title, url) => {
        window.history.replaceState(_data, _title, url);
      });
    getCurrentEmployeeMock.mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'valid-token');
    window.history.replaceState(null, '', '/');

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Business performance')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Main/i })).toHaveClass('sidebar-nav-item-active');

    pushState.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /Orders/i }), { button: 0 });
    });

    expect(pushState).toHaveBeenCalledTimes(1);
    expect(pushState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('page=orders'),
    );

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Orders/i })).toHaveClass('sidebar-nav-item-active');
    });

    window.history.replaceState(null, '', '/');
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Main/i })).toHaveClass('sidebar-nav-item-active');
      expect(screen.getByText('Business performance')).toBeInTheDocument();
    });

    pushState.mockRestore();
  });
});

describe('DashboardPage last sync reload', () => {
  it('clicking Last sync hard reloads the page and preserves login state', async () => {
    getCurrentEmployeeMock.mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'keep-me-token');

    renderDashboardPage();

    const syncButton = await screen.findByRole('button', { name: /Last sync/i });
    expect(syncButton).toHaveClass('topbar-sync-button');
    expect(syncButton).toHaveAttribute('title', 'Reload data');

    fireEvent.click(syncButton);

    expect(hardReloadAppMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(authTokenStorageKey)).toBe('keep-me-token');
  });
});