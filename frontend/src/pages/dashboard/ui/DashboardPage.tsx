import { useState } from 'react';
import { ClientForm } from '../../../features/manage-client/ui/ClientForm';
import { ProductForm } from '../../../features/manage-product/ui/ProductForm';
import { SaleForm } from '../../../features/manage-sale/ui/SaleForm';
import { useDashboardPage } from '../model/useDashboardPage';
import { ClientHistoryPanel } from '../../../widgets/dashboard/ui/ClientHistoryPanel';
import { AnalyticsHeroSection } from '../../../widgets/dashboard/ui/AnalyticsHeroSection';
import { ClientPanel } from '../../../widgets/dashboard/ui/ClientPanel';
import { Notifications } from '../../../widgets/dashboard/ui/Notifications';
import { ProductCatalogPanel } from '../../../widgets/dashboard/ui/ProductCatalogPanel';
import { SalesPanel } from '../../../widgets/dashboard/ui/SalesPanel';
import { OrdersWorkspace } from '../../../widgets/dashboard/ui/OrdersWorkspace';
import { CreateOrderCard } from '../../../widgets/dashboard/ui/CreateOrderCard';
import { EmployeeManagementPanel } from '../../../widgets/dashboard/ui/EmployeeManagementPanel';
import { SettingsPanel } from '../../../widgets/dashboard/ui/SettingsPanel';

type PageKey = 'home' | 'orders' | 'employees' | 'settings';

const sidebarItems: Array<{ key: PageKey | 'other'; label: string }> = [
  { key: 'home', label: 'Main' },
  { key: 'orders', label: 'Orders' },
  { key: 'employees', label: 'Employees' },
  { key: 'settings', label: 'Settings' },
  { key: 'other', label: 'Clients' },
  { key: 'other', label: 'Accounting' },
  { key: 'other', label: 'Warehouses' },
  { key: 'other', label: 'Products & Services' },
  { key: 'other', label: 'Sales' },
  { key: 'other', label: 'Chats' },
  { key: 'other', label: 'More' },
];

export const DashboardPage = () => {
  const { state, actions } = useDashboardPage();
  const [activePage, setActivePage] = useState<PageKey>('home');
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const openOrdersPage = () => {
    setActivePage('orders');
    setIsCreateOrderOpen(false);
  };

  const openCreateOrder = () => {
    setActivePage('orders');
    setIsCreateOrderOpen(true);
  };

  return (
    <main className="dashboard-shell">
      <aside className="app-sidebar">
        <div className="sidebar-profile">
          <div className="sidebar-avatar">AG</div>
          <div>
            <p className="sidebar-user-name">Grigorev Aleksandr</p>
            <p className="sidebar-user-role">Owner</p>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main menu">
          {sidebarItems.map((item) => {
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
                onClose={openOrdersPage}
                onSave={actions.saveOrderRequest}
              />
            ) : (
              <OrdersWorkspace
                sales={state.sales}
                isLoading={state.isSalesLoading}
                searchValue={state.productSearchQuery}
                onSearchChange={actions.setProductSearchQuery}
                onCreateOrder={openCreateOrder}
              />
            )
          ) : activePage === 'employees' ? (
            <EmployeeManagementPanel
              employees={state.allEmployees}
              form={state.employeeForm}
              isLoading={state.isEmployeesLoading}
              isSaving={state.isEmployeeSaving}
              isEditing={Boolean(state.editingEmployeeId)}
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
          ) : (
            <>
              <AnalyticsHeroSection
                sales={state.sales}
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

              <section className="workspace-grid">
                <div className="column-stack">
                  <ProductForm
                    form={state.productForm}
                    isSaving={state.isProductSaving}
                    isEditing={Boolean(state.editingProductId)}
                    onChange={actions.onProductChange}
                    onSubmit={actions.saveProduct}
                    onCancelEdit={actions.resetProductEditor}
                  />

                  <ClientForm
                    clients={state.allClients}
                    form={state.clientForm}
                    isSaving={state.isClientSaving}
                    isEditing={Boolean(state.editingClientId)}
                    onChange={actions.onClientChange}
                    onSubmit={actions.saveClient}
                    onCancelEdit={actions.resetClientEditor}
                    onPickExisting={actions.pickExistingClient}
                  />
                </div>

                <div className="column-stack">
                  <ProductCatalogPanel
                    products={state.products}
                    isLoading={state.isProductsLoading}
                    searchQuery={state.deferredProductSearchQuery}
                    currentSearchValue={state.productSearchQuery}
                    onSearchChange={actions.setProductSearchQuery}
                    onEdit={actions.editProduct}
                    onDelete={actions.deleteProduct}
                  />

                  <SalesPanel
                    sales={state.sales}
                    isLoading={state.isSalesLoading}
                    onEdit={actions.editSale}
                    onDelete={actions.deleteSale}
                  />
                </div>

                <div className="column-stack">
                  <SaleForm
                    clients={state.allClients}
                    products={state.allProducts}
                    form={state.saleForm}
                    isSaving={state.isSaleSaving}
                    isEditing={Boolean(state.editingSaleId)}
                    onChange={actions.onSaleChange}
                    onSubmit={actions.saveSale}
                    onCancelEdit={actions.resetSaleEditor}
                  />

                  <ClientPanel
                    clients={state.clients}
                    isLoading={state.isClientsLoading}
                    searchQuery={state.deferredClientSearchQuery}
                    currentSearchValue={state.clientSearchQuery}
                    selectedClientId={state.selectedClientId}
                    statusFilter={state.clientStatusFilter}
                    onSearchChange={actions.setClientSearchQuery}
                    onStatusFilterChange={actions.setClientStatusFilter}
                    onSelect={(client) => actions.setSelectedClientId(client.id)}
                    onEdit={actions.editClient}
                    onDelete={actions.deleteClient}
                  />

                  <ClientHistoryPanel
                    history={state.clientHistory}
                    isLoading={state.isClientHistoryLoading}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </main>
  );
};
