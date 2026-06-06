import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  acceptInvitation,
  getCurrentEmployee,
  getInvitationDetails,
  login,
  logout,
  authTokenStorageKey,
} from '../../../entities/auth/api/authApi';
import type { Employee } from '../../../entities/employee/model/types';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import { setApiAuthToken } from '../../../shared/api/http';
import {
  isNetworkRequestError,
  isUnauthorizedRequestError,
} from '../../../shared/lib/request';
import { useDashboardPage } from '../model/useDashboardPage';
import { AnalyticsHeroSection } from '../../../widgets/dashboard/ui/AnalyticsHeroSection';
import { Notifications } from '../../../widgets/dashboard/ui/Notifications';
import { OrdersWorkspace } from '../../../widgets/dashboard/ui/OrdersWorkspace';
import { CreateOrderCard } from '../../../widgets/dashboard/ui/CreateOrderCard';
import { EmployeeManagementPanel } from '../../../widgets/dashboard/ui/EmployeeManagementPanel';
import { SettingsPanel } from '../../../widgets/dashboard/ui/SettingsPanel';
import { AccountingPanel } from '../../../widgets/dashboard/ui/AccountingPanel';
import { ProductCatalogPanel } from '../../../widgets/dashboard/ui/ProductCatalogPanel';
import { WarehousePanel } from '../../../widgets/dashboard/ui/WarehousePanel';
import { ClientsSuppliersWorkspace } from '../../../widgets/dashboard/ui/ClientsSuppliersWorkspace';
import { isProductSale, isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import { SupplierOrdersWorkspace } from '../../../widgets/dashboard/ui/SupplierOrdersWorkspace';
import { GlobalHorizontalScrollbar } from '../../../shared/ui/GlobalHorizontalScrollbar';

type PageKey =
  | 'home'
  | 'orders'
  | 'clients'
  | 'employees'
  | 'settings'
  | 'accounting'
  | 'catalog'
  | 'warehouse';
type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';
type CreateOrderTab = 'repair' | 'sale';

const pageKeys: PageKey[] = [
  'home',
  'orders',
  'clients',
  'employees',
  'settings',
  'accounting',
  'catalog',
  'warehouse',
];
const ordersTabs: OrdersTab[] = [
  'orders',
  'sales',
  'supplierOrders',
  'supplierInformation',
];
const ordersTabStorageKey = 'project-goods.orders-tab';
const activePageStorageKey = 'project-goods.dashboard-page';
const employeeSnapshotStorageKey = 'project-goods.employee-snapshot';
const sidebarCollapsedStorageKey = 'project-goods.sidebar-collapsed';

const readEmployeeSnapshot = (): Employee | null => {
  const rawValue = window.localStorage.getItem(employeeSnapshotStorageKey);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Employee;
  } catch {
    window.localStorage.removeItem(employeeSnapshotStorageKey);
    return null;
  }
};

const saveEmployeeSnapshot = (employee: Employee) => {
  window.localStorage.setItem(employeeSnapshotStorageKey, JSON.stringify(employee));
};

const getPageFromUrl = (): PageKey | null => {
  const page = new URLSearchParams(window.location.search).get('page');

  return pageKeys.includes(page as PageKey) ? (page as PageKey) : null;
};

const getStoredActivePage = (): PageKey => {
  const rawPage = window.localStorage.getItem(activePageStorageKey);
  return pageKeys.includes(rawPage as PageKey) ? (rawPage as PageKey) : 'home';
};

const getInvitationTokenFromUrl = () =>
  new URLSearchParams(window.location.search).get('inviteToken')?.trim() ?? '';

const getOrdersTabFromUrl = (): OrdersTab | null => {
  const tab = new URLSearchParams(window.location.search).get('ordersTab');

  return ordersTabs.includes(tab as OrdersTab) ? (tab as OrdersTab) : null;
};

const getCreateOrderFromUrl = (): CreateOrderTab | null => {
  const tab = new URLSearchParams(window.location.search).get('createOrder');

  return tab === 'repair' || tab === 'sale' ? tab : null;
};

const getSaleIdFromUrl = () =>
  new URLSearchParams(window.location.search).get('saleId')?.trim() ?? '';

const getStoredOrdersTab = (): OrdersTab => {
  const tab = window.localStorage.getItem(ordersTabStorageKey);

  return ordersTabs.includes(tab as OrdersTab) ? (tab as OrdersTab) : 'orders';
};

const getStoredSidebarCollapsed = (): boolean => {
  const rawValue = window.localStorage.getItem(sidebarCollapsedStorageKey);

  return rawValue === 'true';
};

const createEmptyInviteState = () => ({
  isLoading: false,
  name: '',
  email: '',
  role: '',
});

const createLoadingInviteState = () => ({
  ...createEmptyInviteState(),
  isLoading: true,
});

const getOrdersTabForCreateOrder = (tab: CreateOrderTab): OrdersTab =>
  tab === 'sale' ? 'sales' : 'orders';

const getCreateOrderForOrdersTab = (tab: OrdersTab): CreateOrderTab =>
  tab === 'sales' ? 'sale' : 'repair';

const getDashboardHref = (
  page: PageKey,
  options: { ordersTab?: OrdersTab; createOrder?: CreateOrderTab; saleId?: string } = {},
) => {
  const url = new URL(window.location.href);

  if (page === 'home') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }

  if (page === 'orders') {
    url.searchParams.set('ordersTab', options.ordersTab ?? 'orders');
  } else {
    url.searchParams.delete('ordersTab');
  }

  if (page !== 'accounting') {
    url.searchParams.delete('accountingTab');
  }

  if (page === 'orders' && options.createOrder) {
    url.searchParams.set('createOrder', options.createOrder);
  } else {
    url.searchParams.delete('createOrder');
  }

  if (page === 'orders' && options.saleId) {
    url.searchParams.set('saleId', options.saleId);
  } else {
    url.searchParams.delete('saleId');
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

const setDashboardUrl = (
  page: PageKey,
  ordersTab: OrdersTab,
  createOrder: CreateOrderTab | null,
  saleId: string | null = null,
) => {
  window.history.replaceState(
    null,
    '',
    getDashboardHref(page, {
      ordersTab,
      createOrder: createOrder ?? undefined,
      saleId: saleId ?? undefined,
    }),
  );
};

const setOrdersTabPreference = (tab: OrdersTab) => {
  window.localStorage.setItem(ordersTabStorageKey, tab);
};

const sidebarItems: Array<{ key: PageKey | 'other'; label: string }> = [
  { key: 'home', label: 'Main' },
  { key: 'orders', label: 'Orders' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'catalog', label: 'Products & Services' },
  { key: 'clients', label: 'Clients & suppliers' },
  { key: 'employees', label: 'Employees' },
  { key: 'settings', label: 'Settings' },
];

const sidebarItemIcons: Record<PageKey, string> = {
  home: '🏠',
  orders: '🧾',
  clients: '📞',
  accounting: '💰',
  catalog: '📁',
  warehouse: '📦',
  settings: '⚙',
  employees: '👥',
};

const isPlainLeftClick = (event: ReactMouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export const DashboardPage = () => {
  const [isOnline, setIsOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(() =>
    Boolean(window.localStorage.getItem(authTokenStorageKey)),
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [inviteToken, setInviteToken] = useState(getInvitationTokenFromUrl);
  const [inviteState, setInviteState] = useState<{
    isLoading: boolean;
    name: string;
    email: string;
    role: string;
  }>(() => (getInvitationTokenFromUrl() ? createLoadingInviteState() : createEmptyInviteState()));
  const { state, actions } = useDashboardPage(Boolean(currentEmployee), currentEmployee);
  const [activePage, setActivePage] = useState<PageKey>(() => getPageFromUrl() ?? getStoredActivePage());
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(() => Boolean(getCreateOrderFromUrl()));
  const [activeOrdersTab, setActiveOrdersTab] = useState<OrdersTab>(
    () => getOrdersTabFromUrl() ?? getStoredOrdersTab(),
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getStoredSidebarCollapsed);
  const [externalSelectedSaleId, setExternalSelectedSaleId] = useState<string | null>(
    () => getSaleIdFromUrl() || null,
  );
  const [openClientCardRequestId, setOpenClientCardRequestId] = useState<string | null>(null);
  const productSales = state.sales.filter(isProductSale);
  const repairOrders = state.sales.filter(isRepairOrder);
  const canCreateOrders =
    currentEmployee?.isActive === true &&
    (currentEmployee.role === 'owner' ||
      currentEmployee.role === 'manager' ||
      currentEmployee.permissions.includes('orders.manage'));
  const canManageEmployees = hasEmployeePermission(currentEmployee, 'employees.manage');
  const canViewAccounting = hasEmployeePermission(currentEmployee, 'finance.view');
  const canManageSettings = currentEmployee?.role === 'owner';
  const shouldShowInvitation = Boolean(inviteToken) && !currentEmployee;
  const visibleInviteState = shouldShowInvitation
    ? inviteState
    : { isLoading: false, name: '', email: '', role: '' };
  const isOffline = !isOnline;

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const token = window.localStorage.getItem(authTokenStorageKey);

    if (!token) {
      setApiAuthToken(null);
      return;
    }

    setApiAuthToken(token);
    void (async () => {
      try {
        const employee = await getCurrentEmployee();
        if (!isActive) return;
        setCurrentEmployee(employee);
        saveEmployeeSnapshot(employee);
      } catch (error) {
        if (!isActive) return;

        if (isUnauthorizedRequestError(error)) {
          window.localStorage.removeItem(authTokenStorageKey);
          window.localStorage.removeItem(employeeSnapshotStorageKey);
          setApiAuthToken(null);
          setCurrentEmployee(null);
          setAuthError('Session expired. Please sign in again.');
          return;
        }

        if (isNetworkRequestError(error)) {
          const snapshot = readEmployeeSnapshot();
          if (snapshot) {
            setCurrentEmployee(snapshot);
            setAuthError('');
          } else {
            setCurrentEmployee(null);
            setAuthError('No internet connection. Sign in requires network access.');
          }
          return;
        }

        window.localStorage.removeItem(authTokenStorageKey);
        window.localStorage.removeItem(employeeSnapshotStorageKey);
        setApiAuthToken(null);
        setCurrentEmployee(null);
      } finally {
        if (isActive) {
          setIsAuthLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ordersTabStorageKey, activeOrdersTab);
    setDashboardUrl(
      activePage,
      activeOrdersTab,
      activePage === 'orders' && isCreateOrderOpen
        ? getCreateOrderForOrdersTab(activeOrdersTab)
        : null,
    );
  }, [activeOrdersTab, activePage, isCreateOrderOpen]);

  useEffect(() => {
    window.localStorage.setItem(activePageStorageKey, activePage);
  }, [activePage]);

  useEffect(() => {
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const syncInviteToken = () => {
      const nextInviteToken = getInvitationTokenFromUrl();
      setInviteToken(nextInviteToken);
      setInviteState(nextInviteToken ? createLoadingInviteState() : createEmptyInviteState());
    };

    window.addEventListener('popstate', syncInviteToken);
    return () => window.removeEventListener('popstate', syncInviteToken);
  }, []);

  useEffect(() => {
    if (!inviteToken || currentEmployee) {
      return;
    }

    let isActive = true;

    void (async () => {
      try {
        const details = await getInvitationDetails(inviteToken);
        if (!isActive) return;
        setInviteState({
          isLoading: false,
          name: details.name,
          email: details.email,
          role: details.role,
        });
      } catch (error) {
        if (!isActive) return;
        setAuthError(error instanceof Error ? error.message : 'Failed to load invitation.');
        setInviteState(createEmptyInviteState());
      }
    })();

    return () => {
      isActive = false;
    };
  }, [currentEmployee, inviteToken]);

  useEffect(() => {
    if (isAuthLoading || currentEmployee) {
      return;
    }

    setDashboardUrl('home', activeOrdersTab, null);
  }, [currentEmployee, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (activePage === 'employees' && !canManageEmployees) {
      setActivePage('home');
      return;
    }
    if (activePage === 'accounting' && !canViewAccounting) {
      setActivePage('home');
      return;
    }
    if (activePage === 'settings' && !canManageSettings) {
      setActivePage('home');
    }
  }, [activePage, canManageEmployees, canManageSettings, canViewAccounting, isAuthLoading]);

  useEffect(() => {
    const syncPageFromHistory = () => {
      const createOrderTab = getCreateOrderFromUrl();
      setActivePage(getPageFromUrl() ?? getStoredActivePage());
      setActiveOrdersTab(
        createOrderTab ? getOrdersTabForCreateOrder(createOrderTab) : getOrdersTabFromUrl() ?? getStoredOrdersTab(),
      );
      setIsCreateOrderOpen(Boolean(createOrderTab));
      setExternalSelectedSaleId(getSaleIdFromUrl() || null);
    };

    window.addEventListener('popstate', syncPageFromHistory);

    return () => window.removeEventListener('popstate', syncPageFromHistory);
  }, []);

  const openOrdersPage = () => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
  };

  const changeOrdersTab = (tab: OrdersTab) => {
    setOrdersTabPreference(tab);
    setActiveOrdersTab(tab);
  };

  const openCreateOrder = (tab: OrdersTab) => {
    if (!canCreateOrders) {
      actions.showError('Current employee does not have permission to create orders.');
      return;
    }

    setActivePage('orders');
    changeOrdersTab(tab);
    setIsCreateOrderOpen(true);
  };

  const openPage = (page: PageKey) => {
    setActivePage(page);
    setIsCreateOrderOpen(false);
  };

  const openSaleFromClientCard = (sale: { id: string; kind: 'repair' | 'sale' }) => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
    changeOrdersTab(sale.kind === 'sale' ? 'sales' : 'orders');
    setExternalSelectedSaleId(sale.id);
  };

  const openClientCardFromOrders = (clientId: string) => {
    setActivePage('clients');
    setIsCreateOrderOpen(false);
    setOpenClientCardRequestId(clientId);
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const session = await login(loginForm);
      window.localStorage.setItem(authTokenStorageKey, session.token);
      setApiAuthToken(session.token);
      setCurrentEmployee(session.employee);
      saveEmployeeSnapshot(session.employee);
      setActivePage('home');
      setActiveOrdersTab('orders');
      setIsCreateOrderOpen(false);
      setDashboardUrl('home', 'orders', null);
      actions.showError('');
      actions.showSuccessMessage('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to login.');
      setCurrentEmployee(null);
      setApiAuthToken(null);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInvitationRegistration = async () => {
    if (!inviteToken) {
      return;
    }

    setIsRegistering(true);
    setAuthError('');

    try {
      const session = await acceptInvitation(inviteToken, loginForm);
      window.localStorage.setItem(authTokenStorageKey, session.token);
      setApiAuthToken(session.token);
      setCurrentEmployee(session.employee);
      saveEmployeeSnapshot(session.employee);
      setLoginForm({ username: '', password: '' });
      setInviteToken('');
      setInviteState(createEmptyInviteState());
      setActivePage('home');
      setActiveOrdersTab('orders');
      setIsCreateOrderOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('inviteToken');
      window.history.replaceState(null, '', url);
      setDashboardUrl('home', 'orders', null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to complete registration.');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout transport errors and clear local session anyway
    } finally {
      window.localStorage.removeItem(authTokenStorageKey);
      window.localStorage.removeItem(employeeSnapshotStorageKey);
      setApiAuthToken(null);
      setCurrentEmployee(null);
      setIsCreateOrderOpen(false);
      setActiveOrdersTab('orders');
      setActivePage('home');
      setDashboardUrl('home', 'orders', null);
    }
  };

  if (isAuthLoading) {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell">
            <section className="panel">
              <h2>Loading session...</h2>
            </section>
          </div>
        </section>
      </main>
    );
  }

  if (!currentEmployee) {
    return (
      <main className="dashboard-shell auth-dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell auth-page-shell">
            <section className="panel auth-panel">
              <div className="panel-header">
                <div>
                  <p className="section-label">Auth</p>
                  <h2>{inviteToken ? 'Complete registration' : 'Login'}</h2>
                </div>
              </div>

              {shouldShowInvitation ? (
                visibleInviteState.isLoading ? (
                  <p className="empty-state">Loading invitation...</p>
                ) : (
                  <div className="form-grid">
                    <label className="field field-wide">
                      <span>Name</span>
                      <input value={visibleInviteState.name} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>Email</span>
                      <input value={visibleInviteState.email} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>Role</span>
                      <input value={visibleInviteState.role} disabled />
                    </label>
                  </div>
                )
              ) : null}

              <div className="form-grid">
                <label className="field field-wide">
                  <span>{inviteToken ? 'Create login' : 'Login'}</span>
                  <input
                    value={loginForm.username}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="username"
                  />
                </label>
                <label className="field field-wide">
                  <span>Password</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="password"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void handleLogin();
                      }
                    }}
                  />
                </label>
              </div>

              {authError ? <p className="empty-state">{authError}</p> : null}

              <button
                className="primary-button"
                type="button"
                onClick={() => void (inviteToken ? handleInvitationRegistration() : handleLogin())}
                disabled={
                  (inviteToken ? isRegistering : isLoggingIn) ||
                  !loginForm.username.trim() ||
                  !loginForm.password.trim()
                }
              >
                {inviteToken
                  ? isRegistering
                    ? 'Completing registration...'
                    : 'Complete registration'
                  : isLoggingIn
                    ? 'Signing in...'
                    : 'Sign in'}
              </button>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={isSidebarCollapsed ? 'dashboard-shell dashboard-shell-collapsed' : 'dashboard-shell'}>
      <aside className={isSidebarCollapsed ? 'app-sidebar app-sidebar-collapsed' : 'app-sidebar'}>
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {currentEmployee.name
              .split(' ')
              .map((part) => part[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className={isSidebarCollapsed ? 'sidebar-profile-meta sidebar-profile-meta-hidden' : 'sidebar-profile-meta'}>
            <p className="sidebar-user-name">{currentEmployee.name}</p>
            <p className="sidebar-user-role">{currentEmployee.role}</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main menu">
          {sidebarItems
            .filter((item) => item.key !== 'employees' || canManageEmployees)
            .filter((item) => item.key !== 'accounting' || canViewAccounting)
            .filter((item) => item.key !== 'settings' || canManageSettings)
            .map((item) => {
            const isActive = item.key !== 'other' && item.key === activePage;
            return (
              <a
                key={item.label}
                href={item.key === 'other' ? '#' : getDashboardHref(item.key)}
                className={isActive ? 'sidebar-nav-item sidebar-nav-item-active' : 'sidebar-nav-item'}
                onClick={(event) => {
                  if (!isPlainLeftClick(event)) return;
                  event.preventDefault();

                  if (item.key === 'home') {
                    openPage('home');
                  }

                  if (item.key === 'orders') {
                    openOrdersPage();
                  }

                  if (item.key === 'employees') {
                    openPage('employees');
                  }

                  if (item.key === 'clients') {
                    openPage('clients');
                  }

                  if (item.key === 'settings') {
                    openPage('settings');
                  }

                  if (item.key === 'accounting') {
                    openPage('accounting');
                  }

                  if (item.key === 'catalog') {
                    openPage('catalog');
                  }

                  if (item.key === 'warehouse') {
                    openPage('warehouse');
                  }
                }}
              >
                <span className="sidebar-nav-item-icon" aria-hidden="true">
                  {item.key !== 'other' ? sidebarItemIcons[item.key] : '\u2022'}
                </span>
                <span className={isSidebarCollapsed ? 'sidebar-nav-item-label sidebar-nav-item-label-hidden' : 'sidebar-nav-item-label'}>
                  {item.label}
                </span>
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu-button"
            aria-label={isSidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
            onClick={() => setIsSidebarCollapsed((previousValue) => !previousValue)}
          >
            &#9776;
          </button>
          <p className="topbar-title">{state.settings?.serviceName || 'Service CRM'}</p>
          {state.lastSyncAt ? (
            <small className="topbar-sync-label">
              {`Last sync: ${new Date(state.lastSyncAt).toLocaleTimeString('uk-UA')}`}
            </small>
          ) : null}
          <div className="topbar-actions">
            <div className="topbar-current-user" title={currentEmployee.name}>
              <span className="topbar-current-user-name">{currentEmployee.name}</span>
              <span className="topbar-current-user-role">{currentEmployee.role}</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => void handleLogout()}>
              Logout
            </button>
          </div>
        </header>

        <div className="page-shell">
          <Notifications
            error={state.error}
            successMessage={state.successMessage}
            isOffline={isOffline}
          />

          {activePage === 'orders' ? (
            isCreateOrderOpen &&
            activeOrdersTab !== 'supplierOrders' &&
            activeOrdersTab !== 'supplierInformation' ? (
                <CreateOrderCard
                  isSaving={state.isSaleSaving}
                  employees={state.allEmployees}
                  currentEmployee={currentEmployee}
                  onClose={openOrdersPage}
                  initialTab={activeOrdersTab === 'sales' ? 'sale' : 'repair'}
                  catalogProducts={state.catalogProducts}
                  products={state.allProducts}
                  sales={state.sales}
                  onSave={actions.saveOrderRequest}
                  onError={actions.showError}
              />
            ) : (
              activeOrdersTab === 'supplierOrders' ||
              activeOrdersTab === 'supplierInformation' ? (
                <SupplierOrdersWorkspace
                  activeTab={activeOrdersTab}
                  onActiveTabChange={changeOrdersTab}
                  suppliers={state.suppliers}
                  catalogProducts={state.catalogProducts}
                  currentEmployeeName={currentEmployee.name}
                  onCreateSupplier={actions.createSupplierCard}
                  onUpdateSupplier={actions.updateSupplierCard}
                  onUpdateCatalogProduct={actions.updateCatalogProductCard}
                  onSuccess={actions.showSuccessMessage}
                  onError={actions.showError}
                />
              ) : (
                <OrdersWorkspace
                  sales={state.sales}
                  products={state.allProducts}
                  employees={state.allEmployees}
                  isLoading={state.isSalesLoading}
                  activeTab={activeOrdersTab}
                  searchValue={state.productSearchQuery}
                  onActiveTabChange={changeOrdersTab}
                  onSearchChange={actions.setProductSearchQuery}
                  onCreateOrder={openCreateOrder}
                  createOrderHref={getDashboardHref('orders', {
                    ordersTab: activeOrdersTab,
                    createOrder: getCreateOrderForOrdersTab(activeOrdersTab),
                  })}
                  currentEmployee={currentEmployee}
                  canCreateOrders={canCreateOrders}
                  onSaleUpdate={actions.replaceSaleInState}
                  onError={actions.showError}
                  onSuccess={actions.showSuccessMessage}
                  externalSelectedSaleId={externalSelectedSaleId}
                  onExternalSaleOpenHandled={() => setExternalSelectedSaleId(null)}
                  onOpenClientCard={openClientCardFromOrders}
                  printForms={state.settings?.printForms ?? state.settingsForm.printForms}
                  printCompanySettings={{
                    serviceName:
                      state.settings?.serviceName ?? state.settingsForm.serviceName,
                    company: state.settings?.company ?? state.settingsForm.company,
                    companyAddress:
                      state.settings?.companyAddress ?? state.settingsForm.companyAddress,
                    companyId: state.settings?.companyId ?? state.settingsForm.companyId,
                    companyIban: state.settings?.companyIban ?? state.settingsForm.companyIban,
                    companyEmail:
                      state.settings?.companyEmail ?? state.settingsForm.companyEmail,
                    companySite:
                      state.settings?.companySite ?? state.settingsForm.companySite,
                  }}
                  onUpdateProductModel={actions.updateProductModelCard}
                />
              )
            )
          ) : activePage === 'employees' ? (
            <EmployeeManagementPanel
              employees={state.allEmployees}
              form={state.employeeForm}
              isLoading={state.isEmployeesLoading}
              isSaving={state.isEmployeeSaving}
              isEditing={Boolean(state.editingEmployeeId)}
              canManageEmployees={canManageEmployees}
              canManageOwnerAccounts={currentEmployee.role === 'owner'}
              currentEmployeeId={currentEmployee.id}
              onChange={actions.onEmployeeChange}
              onSubmit={actions.saveEmployee}
              onCancelEdit={actions.resetEmployeeEditor}
              onEdit={actions.editEmployee}
              onDelete={actions.deleteEmployee}
            />
          ) : activePage === 'clients' ? (
            <ClientsSuppliersWorkspace
              clients={state.allClients}
              suppliers={state.suppliers}
              sales={state.sales}
              selectedClientId={state.selectedClientId}
              history={state.clientHistory}
              isClientsLoading={state.isClientsLoading}
              isHistoryLoading={state.isClientHistoryLoading}
              isSaving={state.isClientSaving}
              onSelectClient={actions.setSelectedClientId}
              onDeleteClient={actions.deleteClient}
              onCreateClient={actions.createClientCard}
              onMergeClients={actions.mergeClients}
              onMergeSuppliers={actions.mergeSuppliers}
              onUpdateClient={actions.updateClientCard}
              onCreateSupplier={actions.createSupplierCard}
              onUpdateSupplier={actions.updateSupplierCard}
              onOpenSaleCard={openSaleFromClientCard}
              openClientCardRequestId={openClientCardRequestId}
              onOpenClientCardHandled={() => setOpenClientCardRequestId(null)}
            />
          ) : activePage === 'settings' && canManageSettings ? (
            <SettingsPanel
              form={state.settingsForm}
              isSaving={state.isSettingsSaving}
              onChange={actions.onSettingsChange}
              onSubmit={actions.saveSettings}
            />
          ) : activePage === 'accounting' ? (
            <AccountingPanel
              currentEmployee={currentEmployee}
              onError={actions.showError}
              onSuccess={actions.showSuccessMessage}
              sales={state.sales}
              onOpenSaleCard={openSaleFromClientCard}
            />
          ) : activePage === 'catalog' ? (
            <ProductCatalogPanel
              products={state.products}
              clientDevices={state.clientDevices}
              catalogProducts={state.catalogProducts}
              isLoading={state.isProductsLoading}
              isCatalogProductsLoading={state.isCatalogProductsLoading}
              searchQuery={state.deferredProductSearchQuery}
              currentSearchValue={state.productSearchQuery}
              productForm={state.productForm}
              isProductSaving={state.isProductSaving}
              isProductEditing={Boolean(state.editingProductId)}
              onSearchChange={actions.setProductSearchQuery}
              onProductChange={actions.onProductChange}
              onProductSubmit={actions.saveProduct}
              onProductCancelEdit={actions.resetProductEditor}
              onArchiveProduct={actions.archiveProduct}
              onActivateProduct={actions.activateProduct}
              services={state.services}
              serviceForm={state.serviceForm}
              isServicesLoading={state.isServicesLoading}
              isServiceSaving={state.isServiceSaving}
              isServiceEditing={Boolean(state.editingServiceId)}
              serviceSearchQuery={state.deferredServiceSearchQuery}
              currentServiceSearchValue={state.serviceSearchQuery}
              onServiceSearchChange={actions.setServiceSearchQuery}
              onServiceChange={actions.onServiceChange}
              onServiceSubmit={actions.saveService}
              onServiceCancelEdit={actions.resetServiceEditor}
              onServiceEdit={actions.editService}
              onServiceArchive={actions.archiveService}
              onServiceActivate={actions.activateService}
              suppliers={state.suppliers}
              onCreateSupplier={actions.createSupplierCard}
              onUpdateSupplier={actions.updateSupplierCard}
              onCreateClientDevice={actions.createClientDeviceCard}
              onUpdateClientDevice={actions.updateClientDeviceCard}
              onDeleteClientDevice={actions.deleteClientDeviceCard}
              onUpdateCatalogProduct={actions.updateCatalogProductCard}
              onCreateCatalogProduct={actions.createCatalogProductCard}
              onDeleteCatalogProduct={actions.deleteCatalogProductCard}
            />
          ) : activePage === 'warehouse' ? (
            <WarehousePanel
              products={state.allProducts}
              sales={state.sales}
              catalogProducts={state.catalogProducts}
              employees={state.allEmployees}
              suppliers={state.suppliers}
              isLoading={state.isProductsLoading}
              productForm={state.productForm}
              isProductSaving={state.isProductSaving}
              isProductEditing={Boolean(state.editingProductId)}
              onProductChange={actions.onProductChange}
              onProductSubmit={actions.saveProduct}
              onProductCancelEdit={actions.resetProductEditor}
              onProductEdit={actions.editProduct}
              onProductDelete={actions.deleteProduct}
              onProductTransfer={actions.transferProduct}
              onCreateSupplier={actions.createSupplierCard}
              onUpdateSupplier={actions.updateSupplierCard}
              onUpdateCatalogProduct={actions.updateCatalogProductCard}
              onUpdateProductModel={actions.updateProductModelCard}
              currentEmployeeName={currentEmployee.name}
              onError={actions.showError}
              onSuccess={actions.showSuccessMessage}
            />
          ) : (
            <AnalyticsHeroSection
              sales={productSales}
              orders={repairOrders}
              products={state.allProducts}
              clientCount={state.allClients.length}
              isSalesLoading={state.isSalesLoading}
              isSeeding={state.isSeeding}
              isExporting={state.isExporting}
              hasProducts={state.products.length > 0}
              statsPeriod={state.statsPeriod}
              onStatsPeriodChange={actions.setStatsPeriod}
              onSeed={actions.eraseAllData}
              onExport={actions.exportProducts}
            />
          )}
        </div>
        <GlobalHorizontalScrollbar />
      </section>
    </main>
  );
};
