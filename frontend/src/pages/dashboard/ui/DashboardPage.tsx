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
import { setApiAuthToken } from '../../../shared/api/http';
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
import { isProductSale, isRepairOrder } from '../../../entities/sale/lib/sale-kind';

type PageKey =
  | 'home'
  | 'orders'
  | 'employees'
  | 'settings'
  | 'accounting'
  | 'catalog'
  | 'warehouse';
type OrdersTab = 'orders' | 'sales';
type CreateOrderTab = 'repair' | 'sale';

const pageKeys: PageKey[] = [
  'home',
  'orders',
  'employees',
  'settings',
  'accounting',
  'catalog',
  'warehouse',
];
const ordersTabs: OrdersTab[] = ['orders', 'sales'];
const ordersTabStorageKey = 'project-goods.orders-tab';

const getPageFromUrl = (): PageKey => {
  const page = new URLSearchParams(window.location.search).get('page');

  return pageKeys.includes(page as PageKey) ? (page as PageKey) : 'home';
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

const getStoredOrdersTab = (): OrdersTab => {
  const tab = window.localStorage.getItem(ordersTabStorageKey);

  return ordersTabs.includes(tab as OrdersTab) ? (tab as OrdersTab) : 'orders';
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
  options: { ordersTab?: OrdersTab; createOrder?: CreateOrderTab } = {},
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

  if (page === 'orders' && options.createOrder) {
    url.searchParams.set('createOrder', options.createOrder);
  } else {
    url.searchParams.delete('createOrder');
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

const setDashboardUrl = (
  page: PageKey,
  ordersTab: OrdersTab,
  createOrder: CreateOrderTab | null,
) => {
  window.history.replaceState(
    null,
    '',
    getDashboardHref(page, { ordersTab, createOrder: createOrder ?? undefined }),
  );
};

const setOrdersTabPreference = (tab: OrdersTab) => {
  window.localStorage.setItem(ordersTabStorageKey, tab);
};

const sidebarItems: Array<{ key: PageKey | 'other'; label: string }> = [
  { key: 'home', label: 'Main' },
  { key: 'orders', label: 'Orders' },
  { key: 'employees', label: 'Employees' },
  { key: 'other', label: 'Clients' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'warehouse', label: 'Warehouses' },
  { key: 'catalog', label: 'Products & Services' },
  { key: 'settings', label: 'Settings' },
];

const isPlainLeftClick = (event: ReactMouseEvent<HTMLAnchorElement>) =>
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

export const DashboardPage = () => {
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
  const [activePage, setActivePage] = useState<PageKey>(getPageFromUrl);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(() => Boolean(getCreateOrderFromUrl()));
  const [activeOrdersTab, setActiveOrdersTab] = useState<OrdersTab>(
    () => getOrdersTabFromUrl() ?? getStoredOrdersTab(),
  );
  const productSales = state.sales.filter(isProductSale);
  const repairOrders = state.sales.filter(isRepairOrder);
  const canCreateOrders =
    currentEmployee?.isActive === true &&
    (currentEmployee.role === 'owner' ||
      currentEmployee.role === 'manager' ||
      currentEmployee.permissions.includes('orders.manage'));
  const canManageEmployees = currentEmployee?.role === 'owner';
  const shouldShowInvitation = Boolean(inviteToken) && !currentEmployee;
  const visibleInviteState = shouldShowInvitation
    ? inviteState
    : { isLoading: false, name: '', email: '', role: '' };

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
      } catch {
        if (!isActive) return;
        window.localStorage.removeItem(authTokenStorageKey);
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
    const syncPageFromHistory = () => {
      const createOrderTab = getCreateOrderFromUrl();
      setActivePage(getPageFromUrl());
      setActiveOrdersTab(
        createOrderTab ? getOrdersTabForCreateOrder(createOrderTab) : getOrdersTabFromUrl() ?? getStoredOrdersTab(),
      );
      setIsCreateOrderOpen(Boolean(createOrderTab));
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

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');

    try {
      const session = await login(loginForm);
      window.localStorage.setItem(authTokenStorageKey, session.token);
      setApiAuthToken(session.token);
      setCurrentEmployee(session.employee);
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
    <main className="dashboard-shell">
      <aside className="app-sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {currentEmployee.name
              .split(' ')
              .map((part) => part[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <p className="sidebar-user-name">{currentEmployee.name}</p>
            <p className="sidebar-user-role">{currentEmployee.role}</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main menu">
          {sidebarItems
            .filter((item) => item.key !== 'employees' || canManageEmployees)
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
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <button type="button" className="topbar-menu-button" aria-label="Open menu">
            &#9776;
          </button>
          <p className="topbar-title">{state.settings?.serviceName || 'Service CRM'}</p>
          <div className="topbar-actions">
            <button type="button" className="ghost-button" onClick={() => void handleLogout()}>
              Logout
            </button>
            <button type="button" className="topbar-icon-button" aria-label="Notifications">
              99+
            </button>
          </div>
        </header>

        <div className="page-shell">
          <Notifications error={state.error} successMessage={state.successMessage} />

          {activePage === 'orders' ? (
            isCreateOrderOpen ? (
              <CreateOrderCard
                isSaving={state.isSaleSaving}
                employees={state.allEmployees}
                currentEmployee={currentEmployee}
                onClose={openOrdersPage}
                initialTab={activeOrdersTab === 'sales' ? 'sale' : 'repair'}
                onSave={actions.saveOrderRequest}
              />
            ) : (
              <OrdersWorkspace
                sales={state.sales}
                isLoading={state.isSalesLoading}
                activeTab={activeOrdersTab}
                searchValue={state.productSearchQuery}
                isSeeding={state.isSeeding}
                onActiveTabChange={changeOrdersTab}
                onSearchChange={actions.setProductSearchQuery}
                onCreateOrder={openCreateOrder}
                createOrderHref={getDashboardHref('orders', {
                  ordersTab: activeOrdersTab,
                  createOrder: getCreateOrderForOrdersTab(activeOrdersTab),
                })}
                currentEmployee={currentEmployee}
                canCreateOrders={canCreateOrders}
                onSeedDemoData={actions.seedDemoData}
                onSaleUpdate={actions.replaceSaleInState}
                onError={actions.showError}
                onSuccess={actions.showSuccessMessage}
              />
            )
          ) : activePage === 'employees' ? (
            <EmployeeManagementPanel
              employees={state.allEmployees}
              form={state.employeeForm}
              isLoading={state.isEmployeesLoading}
              isSaving={state.isEmployeeSaving}
              isEditing={Boolean(state.editingEmployeeId)}
              canManageEmployees={canManageEmployees}
              currentEmployeeId={currentEmployee.id}
              onChange={actions.onEmployeeChange}
              onSubmit={actions.saveEmployee}
              onCancelEdit={actions.resetEmployeeEditor}
              onEdit={actions.editEmployee}
              onDelete={actions.deleteEmployee}
            />
          ) : activePage === 'settings' ? (
            <SettingsPanel
              form={state.settingsForm}
              isSaving={state.isSettingsSaving}
              onChange={actions.onSettingsChange}
              onSubmit={actions.saveSettings}
            />
          ) : activePage === 'accounting' ? (
            <AccountingPanel
              onError={actions.showError}
              onSuccess={actions.showSuccessMessage}
            />
          ) : activePage === 'catalog' ? (
            <ProductCatalogPanel
              products={state.products}
              isLoading={state.isProductsLoading}
              searchQuery={state.deferredProductSearchQuery}
              currentSearchValue={state.productSearchQuery}
              productForm={state.productForm}
              isProductSaving={state.isProductSaving}
              isProductEditing={Boolean(state.editingProductId)}
              onSearchChange={actions.setProductSearchQuery}
              onProductChange={actions.onProductChange}
              onProductSubmit={actions.saveProduct}
              onProductCancelEdit={actions.resetProductEditor}
              onEdit={actions.editProduct}
              onArchiveProduct={actions.archiveProduct}
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
            />
          ) : activePage === 'warehouse' ? (
            <WarehousePanel
              products={state.allProducts}
              isLoading={state.isProductsLoading}
              productForm={state.productForm}
              isProductSaving={state.isProductSaving}
              isProductEditing={Boolean(state.editingProductId)}
              onProductChange={actions.onProductChange}
              onProductSubmit={actions.saveProduct}
              onProductCancelEdit={actions.resetProductEditor}
              onProductEdit={actions.editProduct}
              onProductDelete={actions.deleteProduct}
            />
          ) : (
            <AnalyticsHeroSection
              sales={productSales}
              orders={repairOrders}
              productCount={state.allProducts.length}
              clientCount={state.allClients.length}
              totalFreeStock={state.totalFreeStock}
              isSalesLoading={state.isSalesLoading}
              isSeeding={state.isSeeding}
              isExporting={state.isExporting}
              hasProducts={state.products.length > 0}
              statsPeriod={state.statsPeriod}
              onStatsPeriodChange={actions.setStatsPeriod}
              onSeed={actions.seedDemoData}
              onExport={actions.exportProducts}
            />
          )}
        </div>
      </section>
    </main>
  );
};
