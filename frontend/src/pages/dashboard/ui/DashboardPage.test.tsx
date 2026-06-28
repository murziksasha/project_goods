import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const hardReloadApp = vi.fn();

vi.mock('../../../shared/lib/hardReload', () => ({
  hardReloadApp: (...args: unknown[]) => hardReloadApp(...args),
}));

import { DashboardPage } from './DashboardPage';

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

beforeEach(() => {
  getCurrentEmployeeMock.mockResolvedValue(employee);
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Last sync:/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Last sync:/i }));
    expect(hardReloadApp).toHaveBeenCalledTimes(1);
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
      expect(screen.getByText('Dashboard home')).toBeInTheDocument();
    });

    expect(screen.queryByText('Login')).not.toBeInTheDocument();
    expect(screen.queryByText('Session not found.')).not.toBeInTheDocument();
    expect(screen.getByTestId('notifications')).toHaveTextContent(
      'Session check failed.',
    );
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
      expect(screen.getByText('Dashboard home')).toBeInTheDocument();
    });

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
      expect(screen.getByText('Orders workspace')).toBeInTheDocument();
    });

    window.history.replaceState(null, '', '/');
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      expect(screen.getByText('Dashboard home')).toBeInTheDocument();
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

    expect(hardReloadApp).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(authTokenStorageKey)).toBe('keep-me-token');
  });
});