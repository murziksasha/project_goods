import { useCallback, useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  acceptInvitation,
  getCurrentEmployee,
  getInvitationDetails,
  login,
  logout,
  authTokenStorageKey,
} from '../../../entities/auth/api/authApi';
import type { Employee } from '../../../entities/employee/model/types';
import {
  hasAnyEmployeePermission,
  hasEmployeePermission,
} from '../../../entities/employee/model/permissions';
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
import { useTranslation } from 'react-i18next';
import { hardReloadApp } from '../../../shared/lib/hardReload';
import { LanguageSwitcher } from '../../../shared/ui/LanguageSwitcher';

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
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 720px)').matches
  ) {
    return false;
  }

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

const sidebarItems: Array<{ key: PageKey | 'other'; labelKey: string }> = [
  { key: 'home', labelKey: 'nav.home' },
  { key: 'orders', labelKey: 'nav.orders' },
  { key: 'accounting', labelKey: 'nav.accounting' },
  { key: 'warehouse', labelKey: 'nav.warehouse' },
  { key: 'catalog', labelKey: 'nav.catalog' },
  { key: 'clients', labelKey: 'nav.clients' },
  { key: 'employees', labelKey: 'nav.employees' },
  { key: 'settings', labelKey: 'nav.settings' },
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

const isTemporaryAdmin = (employee: Employee | null) =>
  employee?.role === 'owner' && employee.username === 'admin';

export const DashboardPage = () => {
  const { t, i18n } = useTranslation();
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
  const [urlSelectedSaleId, setUrlSelectedSaleId] = useState<string | null>(
    () => getSaleIdFromUrl() || null,
  );
  const [openClientCardRequestId, setOpenClientCardRequestId] = useState<string | null>(null);
  const productSales = state.sales.filter(isProductSale);
  const repairOrders = state.sales.filter(isRepairOrder);
  const canCreateOrders =
    currentEmployee?.isActive === true &&
    hasEmployeePermission(currentEmployee, 'orders.manage');
  const canViewRepairSalesOrders = hasAnyEmployeePermission(currentEmployee, [
    'orders.view',
    'orders.manage',
    'repairs.execute',
    'sales.manage',
  ]);
  const canViewSupplierOrders = hasAnyEmployeePermission(currentEmployee, [
    'supplierOrders.view',
    'supplierOrders.manage',
  ]);
  const canManageSupplierOrders = hasEmployeePermission(
    currentEmployee,
    'supplierOrders.manage',
  );
  const canViewOrders = canViewRepairSalesOrders || canViewSupplierOrders;
  const availableOrdersTabs = ordersTabs.filter((tab) =>
    tab === 'supplierOrders' || tab === 'supplierInformation'
      ? canViewSupplierOrders
      : canViewRepairSalesOrders,
  );
  const fallbackOrdersTab = availableOrdersTabs[0] ?? 'orders';
  const effectiveOrdersTab = availableOrdersTabs.includes(activeOrdersTab)
    ? activeOrdersTab
    : fallbackOrdersTab;
  const canManageClients = hasEmployeePermission(currentEmployee, 'clients.manage');
  const canManageInventory = hasEmployeePermission(currentEmployee, 'inventory.manage');
  const canManageEmployees = hasEmployeePermission(currentEmployee, 'employees.manage');
  const canViewAccounting = hasEmployeePermission(currentEmployee, 'finance.view');
  const canEditSettings = currentEmployee?.role === 'owner';
  const canManageBackups = hasEmployeePermission(currentEmployee, 'system.backups.manage');
  const canManageSettings = canEditSettings || canManageBackups;
  const canEraseAllData = isTemporaryAdmin(currentEmployee);
  const canAccessPage = useCallback((page: PageKey | 'other') => {
    if (page === 'other') return false;
    if (page === 'home') return true;
    if (page === 'orders') return canViewOrders;
    if (page === 'clients') return canManageClients;
    if (page === 'warehouse' || page === 'catalog') return canManageInventory;
    if (page === 'employees') return canManageEmployees;
    if (page === 'settings') return canManageSettings;
    if (page === 'accounting') return canViewAccounting;

    return false;
  }, [
    canManageClients,
    canManageEmployees,
    canManageInventory,
    canManageSettings,
    canViewAccounting,
    canViewOrders,
    t,
  ]);
  const changeOrdersTab = useCallback((tab: OrdersTab) => {
    if (!availableOrdersTabs.includes(tab)) {
      actions.showError(t('errors.permissionTab'));
      return;
    }
    setOrdersTabPreference(tab);
    setActiveOrdersTab(tab);
  }, [actions, availableOrdersTabs, t]);
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
        setAuthError('');
      } catch (error) {
        if (!isActive) return;

        if (isUnauthorizedRequestError(error)) {
          const snapshot = readEmployeeSnapshot();
          if (snapshot) {
            setCurrentEmployee(snapshot);
            setAuthError(t('errors.sessionCheckFailed'));
          } else {
            window.localStorage.removeItem(authTokenStorageKey);
            window.localStorage.removeItem(employeeSnapshotStorageKey);
            setApiAuthToken(null);
            setCurrentEmployee(null);
            setAuthError(t('errors.sessionExpired'));
          }
          return;
        }

        if (isNetworkRequestError(error)) {
          const snapshot = readEmployeeSnapshot();
          if (snapshot) {
            setCurrentEmployee(snapshot);
            setAuthError('');
          } else {
            setCurrentEmployee(null);
            setAuthError(t('errors.noInternetShort'));
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
      activePage === 'orders' && !isCreateOrderOpen ? urlSelectedSaleId : null,
    );
  }, [activeOrdersTab, activePage, isCreateOrderOpen, urlSelectedSaleId]);

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
        setAuthError(error instanceof Error ? error.message : t('errors.invitationLoadFailed'));
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
  }, [activeOrdersTab, currentEmployee, isAuthLoading]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!canAccessPage(activePage)) {
      setActivePage('home');
    }
  }, [
    activePage,
    canAccessPage,
    isAuthLoading,
    t,
  ]);

  useEffect(() => {
    if (!canViewOrders || availableOrdersTabs.includes(activeOrdersTab)) {
      return;
    }

    changeOrdersTab(fallbackOrdersTab);
  }, [
    activeOrdersTab,
    availableOrdersTabs,
    canViewOrders,
    changeOrdersTab,
    fallbackOrdersTab,
  ]);

  useEffect(() => {
    const syncPageFromHistory = () => {
      const createOrderTab = getCreateOrderFromUrl();
      setActivePage(getPageFromUrl() ?? getStoredActivePage());
      setActiveOrdersTab(
        createOrderTab ? getOrdersTabForCreateOrder(createOrderTab) : getOrdersTabFromUrl() ?? getStoredOrdersTab(),
      );
      setIsCreateOrderOpen(Boolean(createOrderTab));
      setExternalSelectedSaleId(getSaleIdFromUrl() || null);
      setUrlSelectedSaleId(getSaleIdFromUrl() || null);
    };

    window.addEventListener('popstate', syncPageFromHistory);

    return () => window.removeEventListener('popstate', syncPageFromHistory);
  }, []);

  const openOrdersPage = () => {
    if (!canViewOrders) {
      actions.showError(t('errors.permissionOrders'));
      return;
    }
    setActivePage('orders');
    if (!availableOrdersTabs.includes(activeOrdersTab)) {
      changeOrdersTab(fallbackOrdersTab);
    }
    setIsCreateOrderOpen(false);
    setUrlSelectedSaleId(null);
  };

  const openCreateOrder = (tab: OrdersTab) => {
    if (!canCreateOrders) {
      actions.showError(t('errors.permissionCreateOrder'));
      return;
    }

    setActivePage('orders');
    changeOrdersTab(tab);
    setIsCreateOrderOpen(true);
    setUrlSelectedSaleId(null);
  };

  const openPage = (page: PageKey) => {
    if (!canAccessPage(page)) {
      actions.showError(t('errors.permissionPage'));
      return;
    }
    setActivePage(page);
    setIsCreateOrderOpen(false);
  };

  const openSaleFromClientCard = (sale: { id: string; kind: 'repair' | 'sale' }) => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
    changeOrdersTab(sale.kind === 'sale' ? 'sales' : 'orders');
    setExternalSelectedSaleId(sale.id);
    setUrlSelectedSaleId(sale.id);
  };

  const openCreatedOrder = (sale: { id: string; kind: 'repair' | 'sale' }) => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
    changeOrdersTab(sale.kind === 'sale' ? 'sales' : 'orders');
    setExternalSelectedSaleId(sale.id);
    setUrlSelectedSaleId(sale.id);
  };

  const openClientCardFromOrders = (clientId: string) => {
    if (!canManageClients) {
      actions.showError(t('errors.permissionClients'));
      return;
    }
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
      setAuthError(error instanceof Error ? error.message : t('errors.loginFailed'));
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
      setAuthError(error instanceof Error ? error.message : t('errors.registerFailed'));
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
              <h2>{t('common.loading')}</h2>
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
                  <p className="section-label">{t('common.auth')}</p>
                  <h2>{inviteToken ? t('auth.registerTitle') : t('auth.loginTitle')}</h2>
                </div>
              </div>

              {shouldShowInvitation ? (
                visibleInviteState.isLoading ? (
                  <p className="empty-state">{t('common.loadingInvitation')}</p>
                ) : (
                  <div className="form-grid">
                    <label className="field field-wide">
                      <span>{t('common.name')}</span>
                      <input value={visibleInviteState.name} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>{t('common.email')}</span>
                      <input value={visibleInviteState.email} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>{t('common.role')}</span>
                      <input value={visibleInviteState.role} disabled />
                    </label>
                  </div>
                )
              ) : null}

              <div className="form-grid">
                <label className="field field-wide">
                  <span>{inviteToken ? t('auth.createLogin') : t('common.login')}</span>
                  <input
                    value={loginForm.username}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder={t('common.username')}
                  />
                </label>
                <label className="field field-wide">
                  <span>{t('common.password')}</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder={t('common.password')}
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
                    ? t('common.completingRegistration')
                    : t('common.completeRegistration')
                  : isLoggingIn
                    ? t('common.signingIn')
                    : t('common.signIn')}
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

        <nav className="sidebar-nav" aria-label={t('common.openMenu')}>
          {sidebarItems
            .filter((item) => canAccessPage(item.key))
            .map((item) => {
            const isActive = item.key !== 'other' && item.key === activePage;
            return (
              <a
                key={item.key}
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
                  {t(item.labelKey)}
                </span>
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-menu-button"
              aria-label={isSidebarCollapsed ? t('common.expandMenu') : t('common.collapseMenu')}
              onClick={() => setIsSidebarCollapsed((previousValue) => !previousValue)}
            >
              &#9776;
            </button>
            <p className="topbar-title">{state.settings?.serviceName || t('common.serviceCRM')}</p>
          </div>

          {state.lastSyncAt ? (
            <button
              type="button"
              className="topbar-sync-label topbar-sync-button"
              title={t('common.reloadData')}
              onClick={() => void hardReloadApp()}
            >
              {`${t('common.lastSync')}: ${new Date(state.lastSyncAt).toLocaleTimeString(i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US')}`}
            </button>
          ) : null}

          <div className="topbar-actions">
            <LanguageSwitcher />
            <div className="topbar-current-user" title={currentEmployee.name}>
              <span className="topbar-current-user-name">{currentEmployee.name}</span>
              <span className="topbar-current-user-role">{currentEmployee.role}</span>
            </div>
            <button type="button" className="ghost-button" onClick={() => void handleLogout()}>
              {t('common.logout')}
            </button>
          </div>
        </header>

        <div className="page-shell">
          <Notifications
            error={authError || state.error}
            successMessage={state.successMessage}
            isOffline={isOffline}
          />

          {activePage === 'orders' && canViewOrders ? (
            isCreateOrderOpen &&
            effectiveOrdersTab !== 'supplierOrders' &&
            effectiveOrdersTab !== 'supplierInformation' ? (
                <CreateOrderCard
                  isSaving={state.isSaleSaving}
                  employees={state.allEmployees}
                  currentEmployee={currentEmployee}
                  onClose={openOrdersPage}
                  initialTab={effectiveOrdersTab === 'sales' ? 'sale' : 'repair'}
                  catalogProducts={state.catalogProducts}
                  products={state.allProducts}
                  sales={state.sales}
                  clients={state.allClients}
                  onSave={actions.saveOrderRequest}
                  onCreated={openCreatedOrder}
                  onError={actions.showError}
                  onOpenClientCard={openClientCardFromOrders}
              />
            ) : (
              effectiveOrdersTab === 'supplierOrders' ||
              effectiveOrdersTab === 'supplierInformation' ? (
                <SupplierOrdersWorkspace
                  activeTab={effectiveOrdersTab}
                  onActiveTabChange={changeOrdersTab}
                  visibleTabs={availableOrdersTabs}
                  suppliers={state.suppliers}
                  catalogProducts={state.catalogProducts}
                  currentEmployeeName={currentEmployee.name}
                  canViewSupplierOrders={canViewSupplierOrders}
                  canManageSupplierOrders={canManageSupplierOrders}
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
                  activeTab={effectiveOrdersTab}
                  visibleTabs={availableOrdersTabs}
                  searchValue={state.productSearchQuery}
                  onActiveTabChange={changeOrdersTab}
                  onSearchChange={actions.setProductSearchQuery}
                  onCreateOrder={openCreateOrder}
                  createOrderHref={getDashboardHref('orders', {
                    ordersTab: effectiveOrdersTab,
                    createOrder: getCreateOrderForOrdersTab(effectiveOrdersTab),
                  })}
                  currentEmployee={currentEmployee}
                  canCreateOrders={canCreateOrders}
                  onSaleUpdate={actions.replaceSaleInState}
                  onError={actions.showError}
                  onSuccess={actions.showSuccessMessage}
                  externalSelectedSaleId={externalSelectedSaleId}
                  onExternalSaleOpenHandled={() => setExternalSelectedSaleId(null)}
                  onSelectedSaleIdChange={setUrlSelectedSaleId}
                  onOpenClientCard={openClientCardFromOrders}
                  clientDevices={state.clientDevices}
                  catalogProducts={state.catalogProducts}
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
                  onCreateClientDevice={actions.createClientDeviceCard}
                  onUpdateProductModel={actions.updateProductModelCard}
                />
              )
            )
          ) : activePage === 'employees' && canManageEmployees ? (
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
          ) : activePage === 'clients' && canManageClients ? (
            <ClientsSuppliersWorkspace
              currentEmployee={currentEmployee}
              clients={state.allClients}
              suppliers={state.suppliers}
              sales={state.sales}
              selectedClientId={state.selectedClientId}
              history={state.clientHistory}
              isClientsLoading={state.isClientsLoading}
              isHistoryLoading={state.isClientHistoryLoading}
              isSaving={state.isClientSaving}
              isClientImporting={state.isClientImporting}
              isClientExporting={state.isClientExporting}
              onSelectClient={actions.setSelectedClientId}
              onDeleteClient={actions.deleteClient}
              onCreateClient={actions.createClientCard}
              onImportClients={actions.importClientsFromFile}
              onExportClients={actions.exportClients}
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
              canEditSettings={canEditSettings}
              canManageBackups={canManageBackups}
              onChange={actions.onSettingsChange}
              onSubmit={actions.saveSettings}
            />
          ) : activePage === 'accounting' && canViewAccounting ? (
            <AccountingPanel
              currentEmployee={currentEmployee}
              onError={actions.showError}
              onSuccess={actions.showSuccessMessage}
              sales={state.sales}
              onOpenSaleCard={openSaleFromClientCard}
            />
          ) : activePage === 'catalog' && canManageInventory ? (
            <ProductCatalogPanel
              currentEmployee={currentEmployee}
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
          ) : activePage === 'warehouse' && canManageInventory ? (
            <WarehousePanel
              products={state.allProducts}
              sales={state.sales}
              catalogProducts={state.catalogProducts}
              employees={state.allEmployees}
              canViewSupplierOrders={canViewSupplierOrders}
              canManageSupplierOrders={canManageSupplierOrders}
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
              canEraseAllData={canEraseAllData}
              canExportProducts={canManageInventory}
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
