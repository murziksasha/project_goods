import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
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
import { getBuildLabel, getBuildSha } from '../../../shared/lib/buildInfo';
import { useDashboardPage } from '../model/useDashboardPage';
import { AnalyticsHeroSection } from '../../../widgets/dashboard/ui/analytics/AnalyticsHeroSection';
import { Notifications } from '../../../widgets/dashboard/ui/shared/Notifications';
import { OrdersWorkspace } from '../../../widgets/dashboard/ui/orders/workspace/OrdersWorkspace';
import { CreateOrderCard } from '../../../widgets/dashboard/ui/orders/create-order/CreateOrderCard';
import { EmployeesPanel } from '../../../widgets/dashboard/ui/settings/EmployeesPanel';
import { SettingsPanel } from '../../../widgets/dashboard/ui/settings/SettingsPanel';
import { applyPrintFormLocalOverrides } from '../../../widgets/dashboard/model/print-form-local-overrides';
import { AccountingPanel } from '../../../widgets/dashboard/ui/accounting/AccountingPanel';
import { ProductCatalogPanel } from '../../../widgets/dashboard/ui/product-catalog/ProductCatalogPanel';
import { WarehousePanel } from '../../../widgets/dashboard/ui/warehouse/WarehousePanel';
import { ClientsSuppliersWorkspace } from '../../../widgets/dashboard/ui/clients/ClientsSuppliersWorkspace';
import { isProductSale, isRepairOrder } from '../../../entities/sale/lib/sale-kind';
import type { Sale } from '../../../entities/sale/model/types';
import { SupplierOrdersWorkspace } from '../../../widgets/dashboard/ui/supplier-orders/SupplierOrdersWorkspace';
import { GlobalHorizontalScrollbar } from '../../../shared/ui/GlobalHorizontalScrollbar';
import { AccessDeniedPanel } from '../../../shared/ui/AccessDeniedPanel';
import { Button } from '../../../shared/ui/Button';
import { InlineError } from '../../../shared/ui/InlineError';
import { LoadingState } from '../../../shared/ui/LoadingState';
import { useTranslation } from 'react-i18next';
import { hardReloadApp } from '../../../shared/lib/hardReload';
import {
  DashboardSidebar,
  type DashboardSidebarItem,
} from '../../../widgets/dashboard-sidebar/ui/DashboardSidebar';
import { DashboardTopbar } from '../../../widgets/dashboard-topbar/ui/DashboardTopbar';
import {
  CommandPalette,
  type CommandPaletteAction,
} from '../../../widgets/dashboard/ui/command-palette/CommandPalette';
import { DashboardMobileNav } from '../../../widgets/dashboard-mobile-nav/ui/DashboardMobileNav';
import type { AccountingTab } from '../../../widgets/dashboard/model/accounting';
import {
  getDashboardHref,
  navigateDashboard,
  parseDashboardLocationFromWindow,
  type DashboardLocation,
} from '../model/dashboard-navigation';
import {
  getCreateOrderForOrdersTab,
  getCreateOrderFromUrl,
  getOrdersTabFromUrl,
  getPageFromUrlOrNull,
  getStoredOrdersTab,
  ordersTabs,
  type OrdersTab,
  type PageKey,
} from '../model/types';

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

const getStoredActivePage = (): PageKey => {
  const rawPage = window.localStorage.getItem(activePageStorageKey);
  return pageKeys.includes(rawPage as PageKey) ? (rawPage as PageKey) : 'home';
};

const getInvitationTokenFromUrl = () =>
  new URLSearchParams(window.location.search).get('inviteToken')?.trim() ?? '';

const getSaleIdFromUrl = () =>
  new URLSearchParams(window.location.search).get('saleId')?.trim() ?? '';

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

const setOrdersTabPreference = (tab: OrdersTab) => {
  window.localStorage.setItem(ordersTabStorageKey, tab);
};

const sidebarItems: DashboardSidebarItem[] = [
  { key: 'home', labelKey: 'nav.home' },
  { key: 'orders', labelKey: 'nav.orders' },
  { key: 'accounting', labelKey: 'nav.accounting' },
  { key: 'warehouse', labelKey: 'nav.warehouse' },
  { key: 'catalog', labelKey: 'nav.catalog' },
  { key: 'clients', labelKey: 'nav.clients' },
  { key: 'employees', labelKey: 'nav.employees' },
  { key: 'settings', labelKey: 'nav.settings' },
];

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
  const buildLocale = i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US';
  const buildLabel = useMemo(() => getBuildLabel(buildLocale), [buildLocale]);
  const buildSha = useMemo(() => getBuildSha(), []);
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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState(getInvitationTokenFromUrl);
  const [inviteState, setInviteState] = useState<{
    isLoading: boolean;
    name: string;
    email: string;
    role: string;
  }>(() => (getInvitationTokenFromUrl() ? createLoadingInviteState() : createEmptyInviteState()));
  const { state, actions } = useDashboardPage(Boolean(currentEmployee), currentEmployee);
  const effectivePrintForms = useMemo(
    () =>
      applyPrintFormLocalOverrides(
        state.settings?.printForms ?? state.settingsForm.printForms,
        currentEmployee?.id,
      ),
    [
      currentEmployee?.id,
      state.settings?.printForms,
      state.settingsForm.printForms,
    ],
  );
  const [activePage, setActivePage] = useState<PageKey>(() => getPageFromUrlOrNull() ?? getStoredActivePage());
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
  const [pendingPaymentSale, setPendingPaymentSale] = useState<Sale | null>(null);
  const [syncedAccountingTab, setSyncedAccountingTab] = useState<AccountingTab | null>(
    () => parseDashboardLocationFromWindow().accountingTab,
  );
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
  const canEditPrintForms =
    canEditSettings || hasEmployeePermission(currentEmployee, 'printForms.manage');
  const canManageBackups = hasEmployeePermission(currentEmployee, 'system.backups.manage');
  const canManageSettings = canEditSettings || canManageBackups || canEditPrintForms;
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
  const accountingPopstateSyncRef = useRef<
    ((tab: AccountingTab | null) => void) | null
  >(null);
  const hasNormalizedInitialUrlRef = useRef(false);
  const registerAccountingPopstateSync = useCallback(
    (sync: ((tab: AccountingTab | null) => void) | null) => {
      accountingPopstateSyncRef.current = sync;
    },
    [],
  );
  const buildLocationFromState = useCallback(
    (): DashboardLocation => {
      const parsed = parseDashboardLocationFromWindow();

      return {
        page: activePage,
        ordersTab: effectiveOrdersTab,
        createOrder:
          activePage === 'orders' && isCreateOrderOpen
            ? getCreateOrderForOrdersTab(effectiveOrdersTab)
            : null,
        saleId:
          activePage === 'orders' && !isCreateOrderOpen
            ? urlSelectedSaleId
            : null,
        accountingTab:
          activePage === 'accounting' ? parsed.accountingTab : null,
      };
    },
    [
      activePage,
      effectiveOrdersTab,
      isCreateOrderOpen,
      urlSelectedSaleId,
    ],
  );
  const applyLocationToState = useCallback((location: DashboardLocation) => {
    setActivePage(location.page);
    setActiveOrdersTab(location.ordersTab);
    setIsCreateOrderOpen(Boolean(location.createOrder));
    setUrlSelectedSaleId(location.saleId);
    setExternalSelectedSaleId(location.saleId);
    if (location.page !== 'orders') {
      setIsCreateOrderOpen(false);
    }

    const nextInviteToken = getInvitationTokenFromUrl();
    setInviteToken(nextInviteToken);
    setInviteState(
      nextInviteToken ? createLoadingInviteState() : createEmptyInviteState(),
    );
    setSyncedAccountingTab(location.accountingTab);
    accountingPopstateSyncRef.current?.(location.accountingTab);
  }, []);
  const navigateTo = useCallback(
    (next: Partial<DashboardLocation>, options?: { replace?: boolean }) => {
      const parsed = parseDashboardLocationFromWindow();
      const location: DashboardLocation = {
        ...buildLocationFromState(),
        accountingTab:
          next.page === 'accounting' || activePage === 'accounting'
            ? (next.accountingTab ?? parsed.accountingTab)
            : null,
        ...next,
      };

      if (location.page !== 'accounting') {
        location.accountingTab = null;
      }

      applyLocationToState(location);
      navigateDashboard(location, options);
    },
    [activePage, applyLocationToState, buildLocationFromState],
  );
  const changeOrdersTab = useCallback(
    (tab: OrdersTab, options?: { replace?: boolean }) => {
      if (!availableOrdersTabs.includes(tab)) {
        actions.showError(t('errors.permissionTab'));
        return;
      }
      setOrdersTabPreference(tab);
      navigateTo(
        {
          page: 'orders',
          ordersTab: tab,
          createOrder: null,
          saleId: null,
        },
        options,
      );
    },
    [actions, availableOrdersTabs, navigateTo, t],
  );
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
  }, [activeOrdersTab]);

  useEffect(() => {
    window.localStorage.setItem(activePageStorageKey, activePage);
  }, [activePage]);

  useEffect(() => {
    window.localStorage.setItem(sidebarCollapsedStorageKey, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!currentEmployee) return;

    const handleGlobalShortcut = (event: KeyboardEvent) => {
      const isPaletteShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isPaletteShortcut) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], .rapid-sale-modal, .command-palette',
        ) &&
        !isCommandPaletteOpen
      ) {
        // Allow Ctrl+K even from inputs — command palette is intentional.
      }

      event.preventDefault();
      setIsCommandPaletteOpen((current) => !current);
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [currentEmployee, isCommandPaletteOpen]);

  useEffect(() => {
    if (!currentEmployee || hasNormalizedInitialUrlRef.current) {
      return;
    }

    hasNormalizedInitialUrlRef.current = true;
    const parsed = parseDashboardLocationFromWindow();
    const page = getPageFromUrlOrNull() ?? getStoredActivePage();
    const initialLocation: DashboardLocation = {
      page,
      ordersTab: parsed.ordersTab ?? getStoredOrdersTab(),
      createOrder: parsed.createOrder,
      saleId: parsed.saleId,
      accountingTab: page === 'accounting' ? parsed.accountingTab : null,
    };

    applyLocationToState(initialLocation);
    navigateDashboard(initialLocation, { replace: true });
  }, [applyLocationToState, currentEmployee]);

  useEffect(() => {
    const syncFromHistory = () => {
      applyLocationToState(parseDashboardLocationFromWindow());
    };

    window.addEventListener('popstate', syncFromHistory);

    return () => window.removeEventListener('popstate', syncFromHistory);
  }, [applyLocationToState]);

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

    navigateTo(
      {
        page: 'home',
        ordersTab: activeOrdersTab,
        createOrder: null,
        saleId: null,
        accountingTab: null,
      },
      { replace: true },
    );
  }, [activeOrdersTab, currentEmployee, isAuthLoading, navigateTo]);

  useEffect(() => {
    if (!canViewOrders || availableOrdersTabs.includes(activeOrdersTab)) {
      return;
    }

    changeOrdersTab(fallbackOrdersTab, { replace: true });
  }, [
    activeOrdersTab,
    availableOrdersTabs,
    canViewOrders,
    changeOrdersTab,
    fallbackOrdersTab,
  ]);

  const openOrdersPage = () => {
    if (!canViewOrders) {
      actions.showError(t('errors.permissionOrders'));
      return;
    }

    const ordersTab = availableOrdersTabs.includes(activeOrdersTab)
      ? activeOrdersTab
      : fallbackOrdersTab;

    navigateTo({
      page: 'orders',
      ordersTab,
      createOrder: null,
      saleId: null,
      accountingTab: null,
    });
  };

  const openCreateOrder = (tab: OrdersTab) => {
    if (!canCreateOrders) {
      actions.showError(t('errors.permissionCreateOrder'));
      return;
    }

    navigateTo({
      page: 'orders',
      ordersTab: tab,
      createOrder: getCreateOrderForOrdersTab(tab),
      saleId: null,
      accountingTab: null,
    });
  };

  const handleCommandPaletteAction = (action: CommandPaletteAction) => {
    if (action.type === 'page') {
      openPage(action.page);
      return;
    }

    if (action.type === 'createRepair') {
      openCreateOrder('orders');
      return;
    }

    if (action.type === 'createSale') {
      openCreateOrder('sales');
      return;
    }

    if (action.type === 'openSale') {
      navigateTo({
        page: 'orders',
        ordersTab: action.kind === 'sale' ? 'sales' : 'orders',
        createOrder: null,
        saleId: action.saleId,
        accountingTab: null,
      });
      setExternalSelectedSaleId(action.saleId);
    }
  };

  const openPage = (page: PageKey) => {
    if (!canAccessPage(page)) {
      actions.showError(t('errors.permissionPage'));
      return;
    }

    navigateTo({
      page,
      createOrder: null,
      saleId: null,
      accountingTab: null,
    });
  };

  const handleSidebarNavClick = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    item: DashboardSidebarItem,
  ) => {
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
  };

  const openSaleFromClientCard = (sale: { id: string; kind: 'repair' | 'sale' }) => {
    navigateTo({
      page: 'orders',
      ordersTab: sale.kind === 'sale' ? 'sales' : 'orders',
      createOrder: null,
      saleId: sale.id,
      accountingTab: null,
    });
    setExternalSelectedSaleId(sale.id);
  };

  const openCreatedOrder = (sale: { id: string; kind: 'repair' | 'sale' }) => {
    navigateTo({
      page: 'orders',
      ordersTab: sale.kind === 'sale' ? 'sales' : 'orders',
      createOrder: null,
      saleId: sale.id,
      accountingTab: null,
    });
    setExternalSelectedSaleId(sale.id);
  };

  const handleRapidSaleCreated = (sale: Sale) => {
    navigateTo({
      page: 'orders',
      ordersTab: 'sales',
      createOrder: null,
      saleId: null,
      accountingTab: null,
    });
    setIsCreateOrderOpen(false);
    setExternalSelectedSaleId(null);
    setPendingPaymentSale(sale);
  };

  const handleSelectedSaleIdChange = useCallback(
    (saleId: string | null) => {
      navigateTo({
        page: 'orders',
        ordersTab: effectiveOrdersTab,
        createOrder: null,
        saleId,
        accountingTab: null,
      });
    },
    [effectiveOrdersTab, navigateTo],
  );

  const handleNavigateAccountingTab = useCallback(
    (tab: AccountingTab) => {
      navigateTo({
        page: 'accounting',
        accountingTab: tab,
        createOrder: null,
        saleId: null,
      });
    },
    [navigateTo],
  );

  const openClientCardFromOrders = (clientId: string) => {
    if (!canManageClients) {
      actions.showError(t('errors.permissionClients'));
      return;
    }
    navigateTo({
      page: 'clients',
      createOrder: null,
      saleId: null,
      accountingTab: null,
    });
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
      navigateTo(
        {
          page: 'home',
          ordersTab: 'orders',
          createOrder: null,
          saleId: null,
          accountingTab: null,
        },
        { replace: true },
      );
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
      const url = new URL(window.location.href);
      url.searchParams.delete('inviteToken');
      window.history.replaceState(null, '', url);
      navigateTo(
        {
          page: 'home',
          ordersTab: 'orders',
          createOrder: null,
          saleId: null,
          accountingTab: null,
        },
        { replace: true },
      );
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
      navigateTo(
        {
          page: 'home',
          ordersTab: 'orders',
          createOrder: null,
          saleId: null,
          accountingTab: null,
        },
        { replace: true },
      );
    }
  };

  if (isAuthLoading) {
    return (
      <main className="dashboard-shell auth-dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell auth-page-shell">
            <section className="panel auth-panel">
              <LoadingState label={t('common.loading')}>
                {t('common.loading')}
              </LoadingState>
            </section>
          </div>
        </section>
      </main>
    );
  }

  if (!currentEmployee) {
    const submitAuth = () => {
      void (inviteToken ? handleInvitationRegistration() : handleLogin());
    };

    return (
      <main className="dashboard-shell auth-dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell auth-page-shell">
            <section className="panel auth-panel">
              <div className="panel-header auth-panel-brand">
                <div>
                  <p className="section-label">{t('common.serviceCRM')}</p>
                  <h2>{inviteToken ? t('auth.registerTitle') : t('auth.loginTitle')}</h2>
                </div>
              </div>

              {shouldShowInvitation ? (
                visibleInviteState.isLoading ? (
                  <LoadingState label={t('common.loadingInvitation')}>
                    {t('common.loadingInvitation')}
                  </LoadingState>
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
                    autoFocus
                    autoComplete="username"
                    value={loginForm.username}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder={t('common.username')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        submitAuth();
                      }
                    }}
                  />
                </label>
                <label className="field field-wide auth-password-field">
                  <span>{t('common.password')}</span>
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete={inviteToken ? 'new-password' : 'current-password'}
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder={t('common.password')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        submitAuth();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="auth-password-toggle"
                    aria-label={
                      isPasswordVisible
                        ? t('auth.hidePassword')
                        : t('auth.showPassword')
                    }
                    onClick={() => setIsPasswordVisible((current) => !current)}
                  >
                    {isPasswordVisible ? t('auth.hidePasswordShort') : t('auth.showPasswordShort')}
                  </button>
                </label>
              </div>

              {authError ? <InlineError>{authError}</InlineError> : null}

              <Button
                className="auth-submit"
                type="button"
                onClick={submitAuth}
                disabled={
                  (inviteToken ? isRegistering : isLoggingIn) ||
                  !loginForm.username.trim() ||
                  !loginForm.password.trim()
                }
                aria-busy={inviteToken ? isRegistering : isLoggingIn}
              >
                {inviteToken
                  ? isRegistering
                    ? t('common.completingRegistration')
                    : t('common.completeRegistration')
                  : isLoggingIn
                    ? t('common.signingIn')
                    : t('common.signIn')}
              </Button>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={isSidebarCollapsed ? 'dashboard-shell dashboard-shell-collapsed' : 'dashboard-shell'}>
      <DashboardSidebar
        sidebarItems={sidebarItems}
        activePage={activePage}
        isCollapsed={isSidebarCollapsed}
        buildLabel={buildLabel}
        buildSha={buildSha}
        currentEmployee={currentEmployee}
        canAccessPage={canAccessPage}
        onNavClick={handleSidebarNavClick}
      />

      <section className="dashboard-main">
        <DashboardTopbar
          serviceName={state.settings?.serviceName || t('common.serviceCRM')}
          isSidebarCollapsed={isSidebarCollapsed}
          lastSyncAt={state.lastSyncAt}
          buildLocale={buildLocale}
          currentEmployee={currentEmployee}
          primaryActions={
            activePage === 'orders' &&
            canViewOrders &&
            canCreateOrders &&
            !isCreateOrderOpen ? (
              <>
                <button
                  type="button"
                  className="primary-button topbar-create-button"
                  onClick={() => openCreateOrder('orders')}
                >
                  {t('orders.toolbar.createRepair')}
                </button>
                <button
                  type="button"
                  className="secondary-button topbar-create-button"
                  onClick={() => openCreateOrder('sales')}
                >
                  {t('orders.toolbar.createSale')}
                </button>
              </>
            ) : null
          }
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleSidebar={() =>
            setIsSidebarCollapsed((previousValue) => !previousValue)
          }
          onReloadData={() => void hardReloadApp()}
          onLogout={() => void handleLogout()}
        />

        <div className="page-shell">
          {isOffline ? (
            <div className="offline-banner" role="status">
              {t('common.notifications.offlineViewOnly')}
            </div>
          ) : null}
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            canAccessPage={canAccessPage}
            canCreateOrders={canCreateOrders}
            canViewOrders={canViewOrders}
            sales={state.sales}
            onClose={() => setIsCommandPaletteOpen(false)}
            onAction={handleCommandPaletteAction}
          />
          <Notifications
            error={authError || state.error}
            successMessage={state.successMessage}
            isOffline={isOffline}
          />

          {!canAccessPage(activePage) ? (
            <AccessDeniedPanel
              page={activePage}
              allowedPages={pageKeys.filter((page) => canAccessPage(page))}
              onNavigate={openPage}
            />
          ) : activePage === 'orders' && canViewOrders ? (
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
                  onRapidSale={actions.saveRapidSale}
                  onRapidSaleCreated={handleRapidSaleCreated}
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
                  getCreateOrderHref={(tab) =>
                    getDashboardHref('orders', {
                      ordersTab: tab,
                      createOrder: getCreateOrderForOrdersTab(tab),
                    })
                  }
                  currentEmployee={currentEmployee}
                  canCreateOrders={canCreateOrders}
                  onSaleUpdate={actions.replaceSaleInState}
                  onError={actions.showError}
                  onSuccess={actions.showSuccessMessage}
                  externalSelectedSaleId={externalSelectedSaleId}
                  onExternalSaleOpenHandled={() => setExternalSelectedSaleId(null)}
                  onSelectedSaleIdChange={handleSelectedSaleIdChange}
                  onOpenClientCard={openClientCardFromOrders}
                  clientDevices={state.clientDevices}
                  catalogProducts={state.catalogProducts}
                  printForms={effectivePrintForms}
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
                  onUpdateClientDevice={actions.updateClientDeviceCard}
                  onDeleteClientDevice={actions.deleteClientDeviceCard}
                  onUpdateProductModel={actions.updateProductModelCard}
                  pendingPaymentSale={pendingPaymentSale}
                  onPendingPaymentSaleHandled={() => setPendingPaymentSale(null)}
                />
              )
            )
          ) : activePage === 'employees' && canManageEmployees ? (
            <EmployeesPanel
              employees={state.allEmployees}
              sales={state.sales}
              form={state.employeeForm}
              isLoading={state.isEmployeesLoading}
              isSalesLoading={state.isSalesLoading}
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
              clientDevices={state.clientDevices}
              onUpdateClientDevice={actions.updateClientDeviceCard}
              onDeleteClientDevice={actions.deleteClientDeviceCard}
            />
          ) : activePage === 'settings' && canManageSettings ? (
            <SettingsPanel
              form={state.settingsForm}
              isSaving={state.isSettingsSaving}
              canEditSettings={canEditSettings}
              canEditPrintForms={canEditPrintForms}
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
              onNavigateAccountingTab={handleNavigateAccountingTab}
              registerAccountingPopstateSync={registerAccountingPopstateSync}
              syncedAccountingTab={syncedAccountingTab}
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
              printForms={effectivePrintForms}
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
              onOpenSaleCard={openSaleFromClientCard}
            />
          ) : (
            <AnalyticsHeroSection
              sales={productSales}
              orders={repairOrders}
              products={state.allProducts}
              clientCount={state.allClients.length}
              isSalesLoading={state.isSalesLoading}
              isSeeding={state.isSeeding}
              canEraseAllData={canEraseAllData}
              statsPeriod={state.statsPeriod}
              analyticsDateRange={state.analyticsDateRange}
              draftAnalyticsDateRange={state.draftAnalyticsDateRange}
              isAnalyticsDateFilterOpen={state.isAnalyticsDateFilterOpen}
              dashboardPreferences={state.settingsForm.dashboardPreferences}
              onStatsPeriodChange={actions.setStatsPeriod}
              onDraftAnalyticsDateRangeChange={actions.setDraftAnalyticsDateRange}
              onAnalyticsDateFilterOpenChange={actions.setIsAnalyticsDateFilterOpen}
              onApplyAnalyticsDateRange={actions.applyAnalyticsDateRange}
              onClearAnalyticsDateRange={actions.clearAnalyticsDateRange}
              onSeed={actions.eraseAllData}
            />
          )}
        </div>
        <GlobalHorizontalScrollbar />
        <DashboardMobileNav
          items={[
            { key: 'home', labelKey: 'nav.home' },
            { key: 'orders', labelKey: 'nav.orders' },
            { key: 'clients', labelKey: 'nav.clients' },
            { key: 'warehouse', labelKey: 'nav.warehouse' },
            { key: 'accounting', labelKey: 'nav.accounting' },
          ]}
          activePage={activePage}
          canAccessPage={(page) => canAccessPage(page)}
          onNavClick={(event, page) => {
            if (!isPlainLeftClick(event)) return;
            event.preventDefault();
            if (page === 'orders') {
              openOrdersPage();
              return;
            }
            openPage(page);
          }}
        />
      </section>
    </main>
  );
};
