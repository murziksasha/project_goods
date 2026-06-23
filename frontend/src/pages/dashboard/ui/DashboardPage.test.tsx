import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '../../../shared/api/http';
import type { Employee } from '../../../entities/employee/model/types';
import { authTokenStorageKey, getCurrentEmployee } from '../../../entities/auth/api/authApi';
import { DashboardPage } from './DashboardPage';

vi.mock('../../../entities/auth/api/authApi', async () => {
  const actual = await vi.importActual<typeof import('../../../entities/auth/api/authApi')>(
    '../../../entities/auth/api/authApi',
  );
  return {
    ...actual,
    getCurrentEmployee: vi.fn(),
    getInvitationDetails: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
});

vi.mock('../model/useDashboardPage', () => {
  return {
    useDashboardPage: vi.fn(() => ({
      state: {
      allProducts: [],
      clientDevices: [],
      catalogProducts: [],
      suppliers: [],
      allClients: [],
      sales: [],
      services: [],
      allEmployees: [],
      settings: null,
      settingsForm: {
        serviceName: 'Service CRM',
        company: '',
        companyAddress: '',
        companyId: '',
        companyIban: '',
        companyEmail: '',
        companySite: '',
        printForms: [],
      },
      statsPeriod: 'today',
      products: [],
      clients: [],
      clientHistory: null,
      selectedClientId: null,
      productForm: {},
      serviceForm: {},
      clientForm: {},
      saleForm: {},
      employeeForm: {},
      editingProductId: null,
      editingServiceId: null,
      editingClientId: null,
      editingSaleId: null,
      editingEmployeeId: null,
      productSearchQuery: '',
      serviceSearchQuery: '',
      clientSearchQuery: '',
      clientStatusFilter: 'all',
      deferredProductSearchQuery: '',
      deferredServiceSearchQuery: '',
      deferredClientSearchQuery: '',
      totalFreeStock: 0,
      isProductsLoading: false,
      isSuppliersLoading: false,
      isServicesLoading: false,
      isClientsLoading: false,
      isSalesLoading: false,
      isEmployeesLoading: false,
      isCatalogProductsLoading: false,
      isClientHistoryLoading: false,
      isProductSaving: false,
      isServiceSaving: false,
      isClientSaving: false,
      isClientImporting: false,
      isClientExporting: false,
      isSaleSaving: false,
      isEmployeeSaving: false,
      isSettingsSaving: false,
      isExporting: false,
      isSeeding: false,
      error: '',
      successMessage: '',
      lastSyncAt: '2026-06-22T20:05:31.000Z',
    },
    actions: {
      showError: vi.fn(),
      showSuccessMessage: vi.fn(),
      setProductSearchQuery: vi.fn(),
      saveOrderRequest: vi.fn(),
      replaceSaleInState: vi.fn(),
      createSupplierCard: vi.fn(),
      updateSupplierCard: vi.fn(),
      updateCatalogProductCard: vi.fn(),
      setSelectedClientId: vi.fn(),
      deleteClient: vi.fn(),
      createClientCard: vi.fn(),
      importClientsFromFile: vi.fn(),
      exportClients: vi.fn(),
      mergeClients: vi.fn(),
      mergeSuppliers: vi.fn(),
      updateClientCard: vi.fn(),
      onSettingsChange: vi.fn(),
      saveSettings: vi.fn(),
      onProductChange: vi.fn(),
      saveProduct: vi.fn(),
      resetProductEditor: vi.fn(),
      archiveProduct: vi.fn(),
      activateProduct: vi.fn(),
      onServiceSearchChange: vi.fn(),
      onServiceChange: vi.fn(),
      saveService: vi.fn(),
      resetServiceEditor: vi.fn(),
      editService: vi.fn(),
      archiveService: vi.fn(),
      activateService: vi.fn(),
      createClientDeviceCard: vi.fn(),
      updateClientDeviceCard: vi.fn(),
      deleteClientDeviceCard: vi.fn(),
      createCatalogProductCard: vi.fn(),
      deleteCatalogProductCard: vi.fn(),
      transferProduct: vi.fn(),
      updateProductModelCard: vi.fn(),
      onEmployeeChange: vi.fn(),
      saveEmployee: vi.fn(),
      resetEmployeeEditor: vi.fn(),
      editEmployee: vi.fn(),
      deleteEmployee: vi.fn(),
      eraseAllData: vi.fn(),
      exportProducts: vi.fn(),
      setStatsPeriod: vi.fn(),
    },
  })),
  };
});

vi.mock('../../../widgets/dashboard/ui/Notifications', () => ({
  Notifications: ({ error }: { error: string }) => (
    <div data-testid="notifications">{error}</div>
  ),
}));
vi.mock('../../../widgets/dashboard/ui/AnalyticsHeroSection', () => ({
  AnalyticsHeroSection: () => <section>Dashboard home</section>,
}));
vi.mock('../../../widgets/dashboard/ui/OrdersWorkspace', () => ({
  OrdersWorkspace: () => <section>Orders workspace</section>,
}));
vi.mock('../../../widgets/dashboard/ui/CreateOrderCard', () => ({
  CreateOrderCard: () => <section>Create order</section>,
}));
vi.mock('../../../widgets/dashboard/ui/EmployeeManagementPanel', () => ({
  EmployeeManagementPanel: () => <section>Employees</section>,
}));
vi.mock('../../../widgets/dashboard/ui/SettingsPanel', () => ({
  SettingsPanel: () => <section>Settings</section>,
}));
vi.mock('../../../widgets/dashboard/ui/AccountingPanel', () => ({
  AccountingPanel: () => <section>Accounting</section>,
}));
vi.mock('../../../widgets/dashboard/ui/ProductCatalogPanel', () => ({
  ProductCatalogPanel: () => <section>Catalog</section>,
}));
vi.mock('../../../widgets/dashboard/ui/WarehousePanel', () => ({
  WarehousePanel: () => <section>Warehouse</section>,
}));
vi.mock('../../../widgets/dashboard/ui/ClientsSuppliersWorkspace', () => ({
  ClientsSuppliersWorkspace: () => <section>Clients</section>,
}));
vi.mock('../../../widgets/dashboard/ui/SupplierOrdersWorkspace', () => ({
  SupplierOrdersWorkspace: () => <section>Supplier orders</section>,
}));
vi.mock('../../../shared/ui/GlobalHorizontalScrollbar', () => ({
  GlobalHorizontalScrollbar: () => null,
}));

const hardReloadApp = vi.fn();

vi.mock('../../../shared/lib/hardReload', () => ({
  hardReloadApp: (...args: unknown[]) => hardReloadApp(...args),
}));

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('DashboardPage sync control', () => {
  it('hard reloads the app when Last sync is clicked', async () => {
    vi.mocked(getCurrentEmployee).mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'valid-token');

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Last sync:/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Last sync:/i }));
    expect(hardReloadApp).toHaveBeenCalledTimes(1);
  });
});

describe('DashboardPage auth recovery', () => {
  it('keeps the workspace open when session check returns 401 and a snapshot exists', async () => {
    vi.mocked(getCurrentEmployee).mockRejectedValue(
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

    render(<DashboardPage />);

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
    const pushState = vi.spyOn(window.history, 'pushState');
    vi.mocked(getCurrentEmployee).mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'valid-token');
    window.history.replaceState(null, '', '/');

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard home')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: /Orders/i }));
    expect(pushState).toHaveBeenCalled();
    expect(window.location.search).toContain('page=orders');

    await waitFor(() => {
      expect(screen.getByText('Orders workspace')).toBeInTheDocument();
    });

    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(screen.getByText('Dashboard home')).toBeInTheDocument();
    });
  });
});

describe('DashboardPage last sync reload', () => {
  it('clicking Last sync hard reloads the page and preserves login state', async () => {
    vi.mocked(getCurrentEmployee).mockResolvedValue(employee);
    window.localStorage.setItem(authTokenStorageKey, 'keep-me-token');

    render(<DashboardPage />);

    const syncButton = await screen.findByRole('button', { name: /Last sync/i });
    expect(syncButton).toHaveClass('topbar-sync-button');
    expect(syncButton).toHaveAttribute('title', 'Reload data');

    fireEvent.click(syncButton);

    expect(hardReloadApp).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(authTokenStorageKey)).toBe('keep-me-token');
  });
});
