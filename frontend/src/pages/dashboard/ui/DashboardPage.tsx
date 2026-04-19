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

export const DashboardPage = () => {
  const { state, actions } = useDashboardPage();

  return (
    <main className="page-shell">
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

      <Notifications error={state.error} successMessage={state.successMessage} />

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
    </main>
  );
};
