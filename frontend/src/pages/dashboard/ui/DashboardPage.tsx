import { useEffect, useState } from 'react';
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
import { isProductSale, isRepairOrder } from '../../../entities/sale/lib/sale-kind';

type PageKey = 'home' | 'orders' | 'employees' | 'settings' | 'accounting';
type OrdersTab = 'orders' | 'sales';

const pageKeys: PageKey[] = ['home', 'orders', 'employees', 'settings', 'accounting'];

const getPageFromUrl = (): PageKey => {
  const page = new URLSearchParams(window.location.search).get('page');

  return pageKeys.includes(page as PageKey) ? (page as PageKey) : 'home';
};

const getInvitationTokenFromUrl = () =>
  new URLSearchParams(window.location.search).get('inviteToken')?.trim() ?? '';

const setPageInUrl = (page: PageKey) => {
  const url = new URL(window.location.href);

  if (page === 'home') {
    url.searchParams.delete('page');
  } else {
    url.searchParams.set('page', page);
  }

  window.history.replaceState(null, '', url);
};

const sidebarItems: Array<{ key: PageKey | 'other'; label: string }> = [
  { key: 'home', label: 'Main' },
  { key: 'orders', label: 'Orders' },
  { key: 'employees', label: 'Employees' },
  { key: 'other', label: 'Clients' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'other', label: 'Warehouses' },
  { key: 'other', label: 'Products & Services' },
  { key: 'other', label: 'Sales' },
  { key: 'other', label: 'Chats' },
  { key: 'other', label: 'More' },
  { key: 'settings', label: 'Settings' },
];

export const DashboardPage = () => {
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
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
  }>({
    isLoading: false,
    name: '',
    email: '',
    role: '',
  });
  const { state, actions } = useDashboardPage(Boolean(currentEmployee), currentEmployee);
  const [activePage, setActivePage] = useState<PageKey>(getPageFromUrl);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [activeOrdersTab, setActiveOrdersTab] = useState<OrdersTab>('orders');
  const productSales = state.sales.filter(isProductSale);
  const repairOrders = state.sales.filter(isRepairOrder);
  const canCreateOrders =
    currentEmployee?.isActive === true &&
    (currentEmployee.role === 'owner' ||
      currentEmployee.role === 'manager' ||
      currentEmployee.permissions.includes('orders.manage'));
  const canManageEmployees = currentEmployee?.role === 'owner';

  useEffect(() => {
    let isActive = true;
    const token = window.localStorage.getItem(authTokenStorageKey);

    if (!token) {
      setApiAuthToken(null);
      setIsAuthLoading(false);
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
    setPageInUrl(activePage);
  }, [activePage]);

  useEffect(() => {
    const syncInviteToken = () => {
      setInviteToken(getInvitationTokenFromUrl());
    };

    window.addEventListener('popstate', syncInviteToken);
    return () => window.removeEventListener('popstate', syncInviteToken);
  }, []);

  useEffect(() => {
    if (!inviteToken || currentEmployee) {
      setInviteState({ isLoading: false, name: '', email: '', role: '' });
      return;
    }

    let isActive = true;
    setInviteState((current) => ({ ...current, isLoading: true }));

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
        setInviteState({ isLoading: false, name: '', email: '', role: '' });
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

    setActivePage('home');
    setIsCreateOrderOpen(false);
    setPageInUrl('home');
  }, [currentEmployee, isAuthLoading]);

  useEffect(() => {
    const syncPageFromHistory = () => {
      setActivePage(getPageFromUrl());
      setIsCreateOrderOpen(false);
    };

    window.addEventListener('popstate', syncPageFromHistory);

    return () => window.removeEventListener('popstate', syncPageFromHistory);
  }, []);

  const openOrdersPage = () => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
  };

  const openCreateOrder = (tab: OrdersTab) => {
    if (!canCreateOrders) {
      actions.showError('Current employee does not have permission to create orders.');
      return;
    }

    setActivePage('orders');
    setActiveOrdersTab(tab);
    setIsCreateOrderOpen(true);
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
      setPageInUrl('home');
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
      setActivePage('home');
      setActiveOrdersTab('orders');
      setIsCreateOrderOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('inviteToken');
      window.history.replaceState(null, '', url);
      setPageInUrl('home');
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
      setPageInUrl('home');
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
      <main className="dashboard-shell">
        <section className="dashboard-main">
          <div className="page-shell">
            <section className="panel" style={{ maxWidth: 480, margin: '40px auto' }}>
              <div className="panel-header">
                <div>
                  <p className="section-label">Auth</p>
                  <h2>{inviteToken ? 'Complete registration' : 'Login'}</h2>
                </div>
              </div>

              {inviteToken ? (
                inviteState.isLoading ? (
                  <p className="empty-state">Loading invitation...</p>
                ) : (
                  <div className="form-grid">
                    <label className="field field-wide">
                      <span>Name</span>
                      <input value={inviteState.name} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>Email</span>
                      <input value={inviteState.email} disabled />
                    </label>
                    <label className="field field-wide">
                      <span>Role</span>
                      <input value={inviteState.role} disabled />
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
              <button
                key={item.label}
                type="button"
                className={isActive ? 'sidebar-nav-item sidebar-nav-item-active' : 'sidebar-nav-item'}
                onClick={() => {
                  if (item.key === 'home') {
                    setActivePage('home');
                    setIsCreateOrderOpen(false);
                  }

                  if (item.key === 'orders') {
                    openOrdersPage();
                  }

                  if (item.key === 'employees') {
                    setActivePage('employees');
                    setIsCreateOrderOpen(false);
                  }

                  if (item.key === 'settings') {
                    setActivePage('settings');
                    setIsCreateOrderOpen(false);
                  }

                  if (item.key === 'accounting') {
                    setActivePage('accounting');
                    setIsCreateOrderOpen(false);
                  }
                }}
              >
                {item.label}
              </button>
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
                onActiveTabChange={setActiveOrdersTab}
                onSearchChange={actions.setProductSearchQuery}
                onCreateOrder={openCreateOrder}
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
