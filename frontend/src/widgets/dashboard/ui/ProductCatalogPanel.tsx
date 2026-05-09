import { useEffect, useMemo, useState } from 'react';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { ClientDeviceFormValues } from '../../../entities/client-device/model/types';
import type {
  CatalogProduct,
  CatalogProductFormValues,
} from '../../../entities/catalog-product/model/types';
import type { Supplier, SupplierFormValues } from '../../../entities/supplier/model/types';
import type {
  Product,
  ProductFormValues,
} from '../../../entities/product/model/types';
import type {
  ServiceCatalogFormValues,
  ServiceCatalogItem,
} from '../../../entities/service-catalog/model/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { ServiceCatalogForm } from '../../../features/manage-service-catalog/ui/ServiceCatalogForm';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';

type CatalogTab = 'products' | 'catalogProducts' | 'services' | 'suppliers';
const catalogTabStorageKey = 'project-goods.catalog-tab';

type ProductCatalogPanelProps = {
  products: Product[];
  clientDevices: ClientDevice[];
  catalogProducts: CatalogProduct[];
  isCatalogProductsLoading: boolean;
  isLoading: boolean;
  searchQuery: string;
  currentSearchValue: string;
  productForm: ProductFormValues;
  isProductSaving: boolean;
  isProductEditing: boolean;
  onSearchChange: (value: string) => void;
  onProductChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onProductSubmit: () => void | Promise<void>;
  onProductCancelEdit: () => void;
  onArchiveProduct: (product: Product) => void;
  onActivateProduct: (product: Product) => void | Promise<void>;
  services: ServiceCatalogItem[];
  serviceForm: ServiceCatalogFormValues;
  isServicesLoading: boolean;
  isServiceSaving: boolean;
  isServiceEditing: boolean;
  serviceSearchQuery: string;
  currentServiceSearchValue: string;
  onServiceSearchChange: (value: string) => void;
  onServiceChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onServiceSubmit: () => void | Promise<void>;
  onServiceCancelEdit: () => void;
  onServiceEdit: (service: ServiceCatalogItem) => void;
  onServiceArchive: (service: ServiceCatalogItem) => void;
  onServiceActivate: (service: ServiceCatalogItem) => void | Promise<void>;
  suppliers: Supplier[];
  onCreateSupplier: (payload: SupplierFormValues) => Promise<boolean>;
  onUpdateSupplier: (clientId: string, payload: SupplierFormValues) => Promise<boolean>;
  onCreateClientDevice: (payload: ClientDeviceFormValues) => Promise<boolean>;
  onUpdateClientDevice: (deviceId: string, payload: ClientDeviceFormValues) => Promise<boolean>;
  onDeleteClientDevice: (deviceId: string) => Promise<boolean>;
  onUpdateCatalogProduct: (
    catalogProductId: string,
    payload: CatalogProductFormValues,
  ) => Promise<boolean>;
  onDeleteCatalogProduct: (catalogProductId: string) => Promise<boolean>;
};

const tabs: Array<{ key: CatalogTab; label: string }> = [
  { key: 'products', label: 'Clients Device' },
  { key: 'catalogProducts', label: 'Products' },
  { key: 'services', label: 'Services' },
  { key: 'suppliers', label: 'Suppliers' },
];

export const ProductCatalogPanel = ({
  products,
  clientDevices,
  catalogProducts,
  isCatalogProductsLoading,
  isLoading,
  searchQuery,
  currentSearchValue,
  productForm,
  isProductSaving,
  isProductEditing,
  onSearchChange,
  onProductChange,
  onProductSubmit,
  onProductCancelEdit,
  onArchiveProduct,
  onActivateProduct,
  services,
  serviceForm,
  isServicesLoading,
  isServiceSaving,
  isServiceEditing,
  serviceSearchQuery,
  currentServiceSearchValue,
  onServiceSearchChange,
  onServiceChange,
  onServiceSubmit,
  onServiceCancelEdit,
  onServiceEdit,
  onServiceArchive,
  onServiceActivate,
  suppliers,
  onCreateSupplier,
  onUpdateSupplier,
  onCreateClientDevice,
  onUpdateClientDevice,
  onDeleteClientDevice,
  onUpdateCatalogProduct,
  onDeleteCatalogProduct,
}: ProductCatalogPanelProps) => {
  void productForm;
  void isProductSaving;
  void isProductEditing;
  void onProductChange;
  void onProductSubmit;
  void onProductCancelEdit;
  void onArchiveProduct;
  void onActivateProduct;

  const [activeTab, setActiveTab] = useState<CatalogTab>(() => {
    const storedTab = window.localStorage.getItem(catalogTabStorageKey);
    return storedTab === 'products' || storedTab === 'catalogProducts' || storedTab === 'services' || storedTab === 'suppliers'
      ? storedTab
      : 'products';
  });
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(10);
  const [servicesPage, setServicesPage] = useState(1);
  const [servicesPageSize, setServicesPageSize] = useState(10);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedClientDevice, setSelectedClientDevice] = useState<ClientDevice | null>(null);
  const [selectedCatalogProduct, setSelectedCatalogProduct] =
    useState<CatalogProduct | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [isCreateDeviceModalOpen, setIsCreateDeviceModalOpen] = useState(false);
  const [isCreateSupplierModalOpen, setIsCreateSupplierModalOpen] = useState(false);
  const [createDeviceForm, setCreateDeviceForm] = useState({
    name: '',
    note: '',
  });
  const [createSupplierForm, setCreateSupplierForm] = useState({
    name: '',
    phone: '+380',
    note: '',
  });
  const isProductsTab = activeTab === 'products';
  const isCatalogProductsTab = activeTab === 'catalogProducts';
  const isSuppliersTab = activeTab === 'suppliers';
  const filteredClientDevices = useMemo(() => {
    const uniqueByName = new Map<string, ClientDevice>();
    clientDevices.forEach((device) => {
      const key = device.name.trim().toLowerCase();
      if (!key || uniqueByName.has(key)) return;
      uniqueByName.set(key, device);
    });
    const uniqueDevices = Array.from(uniqueByName.values());
    const query = searchQuery.trim().toLowerCase();
    if (!query) return uniqueDevices;
    return uniqueDevices.filter((device) =>
      [device.name, device.clientName, device.clientPhone]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [clientDevices, searchQuery]);
  const paginatedProducts = useMemo(() => {
    const start = (productsPage - 1) * productsPageSize;
    return filteredClientDevices.slice(start, start + productsPageSize);
  }, [filteredClientDevices, productsPage, productsPageSize]);
  const paginatedServices = useMemo(() => {
    const start = (servicesPage - 1) * servicesPageSize;
    return services.slice(start, start + servicesPageSize);
  }, [services, servicesPage, servicesPageSize]);
  const catalogNumbers = new Map(
    [...products, ...services]
      .sort((firstItem, secondItem) =>
        new Date(firstItem.createdAt).getTime() - new Date(secondItem.createdAt).getTime(),
      )
      .map((item, index) => [item.id, index + 1]),
  );

  const openServiceForm = () => {
    onServiceCancelEdit();
    setIsServiceFormOpen(true);
  };

  const editService = (service: ServiceCatalogItem) => {
    onServiceEdit(service);
    setSelectedService(service);
  };

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredClientDevices.length / productsPageSize),
    );
    if (productsPage > pageCount) {
      setProductsPage(pageCount);
    }
  }, [filteredClientDevices.length, productsPage, productsPageSize]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(services.length / servicesPageSize),
    );
    if (servicesPage > pageCount) {
      setServicesPage(pageCount);
    }
  }, [services.length, servicesPage, servicesPageSize]);

  useEffect(() => {
    window.localStorage.setItem(catalogTabStorageKey, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!selectedService) return;
    const updatedSelectedService = services.find((service) => service.id === selectedService.id);
    setSelectedService(updatedSelectedService ?? null);
  }, [services, selectedService]);

  return (
    <section className="panel catalog-table-panel">
      <div className="catalog-tabs" role="tablist" aria-label="Products and services">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              tab.key === activeTab
                ? 'catalog-tab catalog-tab-active'
                : 'catalog-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="catalog-toolbar">
        <button type="button" className="toolbar-square-button" aria-label="Filters">
          ⚙
        </button>
        <button type="button" className="toolbar-filter-button">
          Filter
        </button>
        <div className="orders-search-group catalog-search-group">
          <input
            value={isProductsTab || isSuppliersTab ? currentSearchValue : currentServiceSearchValue}
            placeholder={
              isProductsTab
                ? 'Device name'
                : isCatalogProductsTab
                  ? 'Product name'
                : isSuppliersTab
                  ? 'Supplier name or phone'
                  : 'Service name or note'
            }
            onChange={(event) =>
              isProductsTab || isCatalogProductsTab || isSuppliersTab
                ? (onSearchChange(event.target.value), setProductsPage(1))
                : (onServiceSearchChange(event.target.value), setServicesPage(1))
            }
          />
          <button type="button">Find</button>
        </div>
        <div className="catalog-toolbar-actions">
          {isProductsTab ? (
            <button type="button" className="orders-create-button" onClick={() => setIsCreateDeviceModalOpen(true)}>
              Create device
            </button>
          ) : isSuppliersTab ? (
            <button type="button" className="orders-create-button" onClick={() => setIsCreateSupplierModalOpen(true)}>
              Create supplier
            </button>
          ) : (
            <button type="button" className="orders-create-button" onClick={openServiceForm}>
              {isCatalogProductsTab ? 'Create product' : 'Create service'}
            </button>
          )}
        </div>
      </div>

      {!isProductsTab && !isSuppliersTab && isServiceFormOpen ? (
        <div className="catalog-inline-form">
          <ServiceCatalogForm
            form={serviceForm}
            isSaving={isServiceSaving}
            isEditing={isServiceEditing}
            onChange={onServiceChange}
            onSubmit={onServiceSubmit}
            onCancelEdit={() => {
              onServiceCancelEdit();
              setIsServiceFormOpen(false);
            }}
          />
        </div>
      ) : null}

      {isProductsTab ? (
        <>
          <ProductsTable
            products={paginatedProducts}
            isLoading={isLoading}
            searchQuery={searchQuery}
            rowStartIndex={(productsPage - 1) * productsPageSize}
            onSelectDevice={setSelectedClientDevice}
          />
          <PaginationPanel
            totalItems={filteredClientDevices.length}
            page={productsPage}
            pageSize={productsPageSize}
            onPageChange={setProductsPage}
            onPageSizeChange={(nextPageSize) => {
              setProductsPageSize(nextPageSize);
              setProductsPage(1);
            }}
          />
        </>
      ) : isCatalogProductsTab ? (
        <CatalogProductsTable
          products={catalogProducts}
          isLoading={isCatalogProductsLoading}
          searchQuery={searchQuery}
          onSelectProduct={setSelectedCatalogProduct}
        />
      ) : isSuppliersTab ? (
        <SuppliersTable suppliers={suppliers} searchQuery={searchQuery} onSelectSupplier={setSelectedSupplier} />
      ) : (
        <>
          <ServicesTable
            services={paginatedServices}
            isLoading={isServicesLoading}
            searchQuery={serviceSearchQuery}
            onEdit={editService}
            rowStartIndex={(servicesPage - 1) * servicesPageSize}
          />
          <PaginationPanel
            totalItems={services.length}
            page={servicesPage}
            pageSize={servicesPageSize}
            onPageChange={setServicesPage}
            onPageSizeChange={(nextPageSize) => {
              setServicesPageSize(nextPageSize);
              setServicesPage(1);
            }}
          />
        </>
      )}

      {selectedService && !isSuppliersTab ? (
        <CatalogServiceModal
          service={selectedService}
          form={serviceForm}
          isSaving={isServiceSaving}
          isEditing={isServiceEditing}
          onChange={onServiceChange}
          onSubmit={onServiceSubmit}
          onClose={() => {
            onServiceCancelEdit();
            setSelectedService(null);
          }}
          onArchive={() => {
            onServiceArchive(selectedService);
            setSelectedService(null);
          }}
          onActivate={() => onServiceActivate(selectedService)}
          catalogNumber={catalogNumbers.get(selectedService.id) ?? 0}
        />
      ) : null}

      {selectedSupplier ? (
        <SupplierModal
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
          onSave={async (payload) => {
            const ok = await onUpdateSupplier(selectedSupplier.id, payload);
            if (ok) setSelectedSupplier(null);
          }}
          onCreate={onCreateSupplier}
        />
      ) : null}

      {selectedClientDevice ? (
        <ClientDeviceModal
          device={selectedClientDevice}
          onClose={() => setSelectedClientDevice(null)}
          onSave={async (payload) => {
            const ok = await onUpdateClientDevice(selectedClientDevice.id, payload);
            if (ok) setSelectedClientDevice(null);
          }}
          onRemove={async () => {
            if (!window.confirm(`Remove device \"${selectedClientDevice.name}\"?`)) return;
            const ok = await onDeleteClientDevice(selectedClientDevice.id);
            if (ok) setSelectedClientDevice(null);
          }}
        />
      ) : null}

      {selectedCatalogProduct ? (
        <CatalogSuggestionProductModal
          product={selectedCatalogProduct}
          onClose={() => setSelectedCatalogProduct(null)}
          onSave={async (payload) => {
            const ok = await onUpdateCatalogProduct(selectedCatalogProduct.id, payload);
            if (ok) setSelectedCatalogProduct(null);
          }}
          onRemove={async () => {
            if (!window.confirm(`Remove product \"${selectedCatalogProduct.name}\"?`)) return;
            const ok = await onDeleteCatalogProduct(selectedCatalogProduct.id);
            if (ok) setSelectedCatalogProduct(null);
          }}
        />
      ) : null}

      {isCreateDeviceModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateDeviceModalOpen(false); }}>
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title"><h2>Client device</h2></div>
              <button type="button" className="create-order-close" onClick={() => setIsCreateDeviceModalOpen(false)} aria-label="Close">&times;</button>
            </header>
            <div className="catalog-edit-body">
              <label className="field"><span>Device name</span><input value={createDeviceForm.name} onChange={(e) => setCreateDeviceForm((c) => ({ ...c, name: e.target.value }))} /></label>
              <label className="field field-wide"><span>Note</span><textarea rows={3} value={createDeviceForm.note} onChange={(e) => setCreateDeviceForm((c) => ({ ...c, note: e.target.value }))} /></label>
            </div>
            <footer className="catalog-edit-footer">
              <button type="button" className="secondary-button" onClick={() => setIsCreateDeviceModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary-button" disabled={!createDeviceForm.name.trim()} onClick={async () => {
                const ok = await onCreateClientDevice({
                  clientId: '',
                  clientName: '',
                  clientPhone: '',
                  ...createDeviceForm,
                  serialNumber: '',
                  source: 'clientCard',
                  isActive: true,
                });
                if (ok) {
                  setIsCreateDeviceModalOpen(false);
                  setCreateDeviceForm({ name: '', note: '' });
                }
              }}>Save</button>
            </footer>
          </section>
        </div>
      ) : null}

      {isCreateSupplierModalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCreateSupplierModalOpen(false); }}>
          <section className="catalog-edit-modal" role="dialog" aria-modal="true">
            <header className="catalog-edit-header">
              <div className="catalog-edit-title"><h2>Create supplier</h2></div>
              <button type="button" className="create-order-close" onClick={() => setIsCreateSupplierModalOpen(false)} aria-label="Close">&times;</button>
            </header>
            <div className="catalog-edit-body">
              <label className="field"><span>Name</span><input value={createSupplierForm.name} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, name: e.target.value }))} /></label>
              <label className="field"><span>Phone</span><input value={createSupplierForm.phone} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, phone: e.target.value }))} /></label>
              <label className="field field-wide"><span>Note</span><textarea rows={3} value={createSupplierForm.note} onChange={(e) => setCreateSupplierForm((c) => ({ ...c, note: e.target.value }))} /></label>
            </div>
            <footer className="catalog-edit-footer">
              <button type="button" className="primary-button" disabled={!createSupplierForm.name.trim() || !createSupplierForm.phone.trim()} onClick={async () => {
                const ok = await onCreateSupplier({ ...createSupplierForm, isActive: true });
                if (ok) {
                  setIsCreateSupplierModalOpen(false);
                  setCreateSupplierForm({ name: '', phone: '+380', note: '' });
                }
              }}>Create</button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
};

const SuppliersTable = ({ suppliers, searchQuery, onSelectSupplier }: { suppliers: Supplier[]; searchQuery: string; onSelectSupplier: (supplier: Supplier) => void }) => {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSuppliers = normalizedQuery
    ? suppliers.filter((supplier) => [supplier.name, supplier.phone, supplier.note].join(' ').toLowerCase().includes(normalizedQuery))
    : suppliers;
  if (filteredSuppliers.length === 0) return <p className="empty-state">{normalizedQuery ? 'No suppliers found.' : 'No suppliers yet.'}</p>;
  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table">
        <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          {filteredSuppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.id.slice(-6)}</td>
              <td>
                <button type="button" className="catalog-name-button" onClick={() => onSelectSupplier(supplier)}>
                  {supplier.name}
                </button>
              </td>
              <td>{supplier.phone}</td>
              <td>{supplier.isActive ? 'active' : 'inactive'}</td>
              <td>{formatDate(supplier.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SupplierModal = ({
  supplier,
  onClose,
  onSave,
  onCreate,
}: {
  supplier: Supplier;
  onClose: () => void;
  onSave: (payload: SupplierFormValues) => Promise<void>;
  onCreate: (payload: SupplierFormValues) => Promise<boolean>;
}) => {
  useLockBodyScroll();
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone);
  const [note, setNote] = useState(supplier.note ?? '');
  const [isActive, setIsActive] = useState(supplier.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      name: name.trim(),
      phone: phone.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
  };

  const createCopy = async () => {
    if (!name.trim() || !phone.trim()) return;
    setIsSaving(true);
    const ok = await onCreate({
      name: `${name.trim()} (new)`,
      phone: phone.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <span>{`ID ${supplier.id.slice(-6)}`}</span>
            <h2>Supplier</h2>
          </div>
          <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="catalog-edit-body">
          <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="field field-wide"><span>Note</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field"><span>Status</span><select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <footer className="catalog-edit-footer">
          <button type="button" className="secondary-button" onClick={createCopy} disabled={isSaving}>Add new</button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={isSaving || !name.trim() || !phone.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
};

type ProductsTableProps = {
  products: ClientDevice[];
  isLoading: boolean;
  searchQuery: string;
  rowStartIndex: number;
  onSelectDevice: (device: ClientDevice) => void;
};

const ProductsTable = ({
  products,
  isLoading,
  searchQuery,
  rowStartIndex,
  onSelectDevice,
}: ProductsTableProps) => {
  if (isLoading) return <p className="empty-state">Loading products...</p>;

  if (products.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery ? 'No products found.' : 'No products yet.'}
      </p>
    );
  }

  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Activity</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td>{rowStartIndex + index + 1}</td>
              <td>
                <button type="button" className="catalog-name-button" onClick={() => onSelectDevice(product)}>
                  {product.name}
                </button>
              </td>
              <td>{product.isActive ? 'active' : 'inactive'}</td>
              <td>{formatDate(product.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CatalogProductsTable = ({
  products,
  isLoading,
  searchQuery,
  onSelectProduct,
}: {
  products: CatalogProduct[];
  isLoading: boolean;
  searchQuery: string;
  onSelectProduct: (product: CatalogProduct) => void;
}) => {
  if (isLoading) return <p className="empty-state">Loading products...</p>;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = normalizedQuery
    ? products.filter((product) =>
        [product.name, product.note].join(' ').toLowerCase().includes(normalizedQuery),
      )
    : products;

  if (filtered.length === 0) {
    return (
      <p className="empty-state">
        {normalizedQuery ? 'No products found.' : 'No products yet.'}
      </p>
    );
  }

  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Activity</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>
                <button
                  type="button"
                  className="catalog-name-button"
                  onClick={() => onSelectProduct(product)}
                >
                  {product.name}
                </button>
              </td>
              <td>{product.isActive ? 'active' : 'inactive'}</td>
              <td>{formatDate(product.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type ServicesTableProps = {
  services: ServiceCatalogItem[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (service: ServiceCatalogItem) => void;
  rowStartIndex: number;
};

const ServicesTable = ({
  services,
  isLoading,
  searchQuery,
  onEdit,
  rowStartIndex,
}: ServicesTableProps) => {
  if (isLoading) return <p className="empty-state">Loading services...</p>;

  if (services.length === 0) {
    return (
      <p className="empty-state">
        {searchQuery ? 'No services found.' : 'No services yet.'}
      </p>
    );
  }

  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table">
        <thead>
          <tr>
            <th>ID</th>
            <th><input type="checkbox" aria-label="Select all services" /></th>
            <th>Name</th>
            <th>Price</th>
            <th>Note</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service, index) => (
            <tr key={service.id}>
              <td>{rowStartIndex + index + 1}</td>
              <td><input type="checkbox" aria-label={`Select ${service.name}`} /></td>
              <td>
                <button
                  type="button"
                  className="catalog-name-button"
                  onClick={() => onEdit(service)}
                >
                  {service.name}
                </button>
                {!service.isActive ? <span className="catalog-inactive-badge">Inactive</span> : null}
              </td>
              <td>{formatCurrency(service.price)}</td>
              <td>{service.note || '-'}</td>
              <td>{formatDate(service.updatedAt)}</td>
              <td>
                <div className="catalog-row-actions">
                  <button type="button" className="danger-button" onClick={() => onEdit(service)}>
                    x
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

type CatalogProductModalProps = {
  product: Product;
  catalogNumber: number;
  form: ProductFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  onArchive: () => void;
  onActivate: () => void;
};

const getPriceOption = (form: ProductFormValues, index: number) =>
  form.salePriceOptions
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[index] ?? '';

const setPriceOption = (
  form: ProductFormValues,
  index: number,
  value: string,
) => {
  const values = form.salePriceOptions
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  values[index] = value;
  return values.join(', ');
};

const getServicePriceOption = (form: ServiceCatalogFormValues, index: number) =>
  (form.salePriceOptions ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[index] ?? '';

const setServicePriceOption = (
  form: ServiceCatalogFormValues,
  index: number,
  value: string,
) => {
  const values = form.salePriceOptions
    ? form.salePriceOptions
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    : [];
  values[index] = value;
  return values.join(', ');
};

export const CatalogProductModal = ({
  product,
  catalogNumber,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
  onArchive,
  onActivate,
}: CatalogProductModalProps) => {
  useLockBodyScroll();

  const saveAndClose = async () => {
    await onSubmit();
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
      <header className="catalog-edit-header">
        <div className="catalog-edit-title">
          <span>{`ID ${catalogNumber || '-'}`}</span>
          <h2>{product.name}</h2>
        </div>
        <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className="catalog-edit-body">
        <h3>Main information</h3>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>
        <label className="field">
          <span>Article</span>
          <input value={form.article} onChange={(event) => onChange('article', event.target.value)} />
        </label>
        <label className="field">
          <span>Serial number</span>
          <input value={form.serialNumber} onChange={(event) => onChange('serialNumber', event.target.value)} />
        </label>

        <fieldset className="catalog-type-field">
          <legend>Item type</legend>
          <label><input type="radio" checked readOnly /> Product</label>
          <label><input type="radio" disabled /> Service</label>
          <label><input type="radio" disabled /> Complex product</label>
        </fieldset>

        <label className="field">
          <span>Unit</span>
          <select value="pcs" disabled>
            <option value="pcs">Default (pcs)</option>
          </select>
        </label>

        <label className="field field-wide">
          <span>Note</span>
          <textarea rows={3} value={form.note} onChange={(event) => onChange('note', event.target.value)} />
        </label>

        <div className="catalog-price-grid">
          <label className="field">
            <span>Stock balance</span>
            <input value={`${product.freeQuantity} pcs free / ${product.quantity} total`} disabled />
          </label>
          <label className="field">
            <span>Retail price</span>
            <NumberStepper
              min={0}
              value={getPriceOption(form, 0) || form.price}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 0, value))
              }
            />
          </label>
          <label className="field">
            <span>Wholesale price 1</span>
            <NumberStepper
              min={0}
              value={getPriceOption(form, 1)}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 1, value))
              }
            />
          </label>
          <label className="field">
            <span>Wholesale price 2</span>
            <NumberStepper
              min={0}
              value={getPriceOption(form, 2)}
              onChange={(value) =>
                onChange('salePriceOptions', setPriceOption(form, 2, value))
              }
            />
          </label>
          <label className="field">
            <span>Purchase price</span>
            <NumberStepper min={0} value={form.price} onChange={(value) => onChange('price', value)} />
          </label>
          <label className="field">
            <span>Warehouse</span>
            <input value={form.purchasePlace} onChange={(event) => onChange('purchasePlace', event.target.value)} />
          </label>
        </div>

        <div className="catalog-edit-summary">
          <p>{`Retail: ${formatCurrency(Number(getPriceOption(form, 0) || form.price || product.price))}`}</p>
          <p>{`Wholesale 1: ${formatCurrency(Number(getPriceOption(form, 1) || 0))}`}</p>
          <p>{`Wholesale 2: ${formatCurrency(Number(getPriceOption(form, 2) || 0))}`}</p>
          <p>{`Free stock: ${product.freeQuantity} pcs`}</p>
          <p>{`Total stock: ${product.quantity} pcs`}</p>
        </div>
      </div>

      <footer className="catalog-edit-footer">
        <button type="button" className="danger-button catalog-danger-wide" onClick={onArchive}>
          Delete / deactivate
        </button>
        <button
          type="button"
          className="primary-button catalog-activate-button"
          onClick={onActivate}
          disabled={isSaving || product.isActive}
        >
          Activate
        </button>
        <button type="button" className="primary-button" onClick={() => void saveAndClose()} disabled={isSaving || !isEditing}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </footer>
      </section>
    </div>
  );
};

type CatalogServiceModalProps = {
  service: ServiceCatalogItem;
  catalogNumber: number;
  form: ServiceCatalogFormValues;
  isSaving: boolean;
  isEditing: boolean;
  onChange: <K extends keyof ServiceCatalogFormValues>(
    field: K,
    value: ServiceCatalogFormValues[K],
  ) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  onArchive: () => void;
  onActivate: () => void;
};

const CatalogServiceModal = ({
  service,
  catalogNumber,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
  onArchive,
  onActivate,
}: CatalogServiceModalProps) => {
  useLockBodyScroll();

  const saveAndClose = async () => {
    await onSubmit();
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
      <header className="catalog-edit-header">
        <div className="catalog-edit-title">
          <span>{`ID ${catalogNumber || '-'}`}</span>
          <h2>{service.name}</h2>
        </div>
        <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className="catalog-edit-body">
        <h3>Main information</h3>
        <label className="field">
          <span>Name</span>
          <input value={form.name} onChange={(event) => onChange('name', event.target.value)} />
        </label>
        <fieldset className="catalog-type-field">
          <legend>Item type</legend>
          <label><input type="radio" disabled /> Product</label>
          <label><input type="radio" checked readOnly /> Service</label>
        </fieldset>
        <label className="field">
          <span>Retail price</span>
          <NumberStepper min={0} value={form.price} onChange={(value) => onChange('price', value)} />
        </label>
        <div className="catalog-price-grid">
          <label className="field">
            <span>Wholesale price 1</span>
            <NumberStepper
              min={0}
              value={getServicePriceOption(form, 0)}
              onChange={(value) =>
                onChange('salePriceOptions', setServicePriceOption(form, 0, value))
              }
            />
          </label>
          <label className="field">
            <span>Wholesale price 2</span>
            <NumberStepper
              min={0}
              value={getServicePriceOption(form, 1)}
              onChange={(value) =>
                onChange('salePriceOptions', setServicePriceOption(form, 1, value))
              }
            />
          </label>
        </div>
        <label className="field field-wide">
          <span>Note</span>
          <textarea rows={3} value={form.note} onChange={(event) => onChange('note', event.target.value)} />
        </label>
        <div className="catalog-edit-summary">
          <p>{`Retail: ${formatCurrency(Number(form.price || service.price))}`}</p>
          <p>{`Wholesale 1: ${formatCurrency(Number(getServicePriceOption(form, 0) || 0))}`}</p>
          <p>{`Wholesale 2: ${formatCurrency(Number(getServicePriceOption(form, 1) || 0))}`}</p>
          <p>{`Status: ${service.isActive ? 'Active' : 'Inactive'}`}</p>
        </div>
      </div>

      <footer className="catalog-edit-footer">
        <button type="button" className="danger-button catalog-danger-wide" onClick={onArchive}>
          Delete / deactivate
        </button>
        <button
          type="button"
          className="primary-button catalog-activate-button"
          onClick={onActivate}
          disabled={isSaving || service.isActive}
        >
          Activate
        </button>
        <button type="button" className="primary-button" onClick={() => void saveAndClose()} disabled={isSaving || !isEditing}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </footer>
      </section>
    </div>
  );
};

const ClientDeviceModal = ({
  device,
  onClose,
  onSave,
  onRemove,
}: {
  device: ClientDevice;
  onClose: () => void;
  onSave: (payload: ClientDeviceFormValues) => Promise<void>;
  onRemove: () => Promise<void>;
}) => {
  useLockBodyScroll();
  const [name, setName] = useState(device.name);
  const [note, setNote] = useState(device.note);
  const [isActive, setIsActive] = useState(device.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      clientId: device.clientId,
      clientName: device.clientName,
      clientPhone: device.clientPhone,
      name: name.trim(),
      serialNumber: '',
      note: note.trim(),
      source: device.source,
      isActive,
      expectedUpdatedAt: device.updatedAt,
    });
    setIsSaving(false);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <h2>Client device</h2>
          </div>
          <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="catalog-edit-body">
          <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field field-wide"><span>Note</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field">
            <span>Status</span>
            <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={() => void onRemove()} disabled={!device.canRemove || isSaving}>
            Remove
          </button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={isSaving || name.trim().length < 2}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
};

const CatalogSuggestionProductModal = ({
  product,
  onClose,
  onSave,
  onRemove,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onSave: (payload: CatalogProductFormValues) => Promise<void>;
  onRemove: () => Promise<void>;
}) => {
  useLockBodyScroll();
  const [name, setName] = useState(product.name);
  const [note, setNote] = useState(product.note);
  const [isActive, setIsActive] = useState(product.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    await onSave({
      name: name.trim(),
      note: note.trim(),
      isActive,
    });
    setIsSaving(false);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="catalog-edit-modal" role="dialog" aria-modal="true">
        <header className="catalog-edit-header">
          <div className="catalog-edit-title">
            <h2>Product</h2>
          </div>
          <button type="button" className="create-order-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>
        <div className="catalog-edit-body">
          <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field field-wide"><span>Note</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field">
            <span>Status</span>
            <select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>
        <footer className="catalog-edit-footer">
          <button type="button" className="danger-button catalog-danger-wide" onClick={() => void onRemove()} disabled={product.canRemove === false || isSaving}>
            Remove
          </button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={isSaving || name.trim().length < 2}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </section>
    </div>
  );
};

const useLockBodyScroll = () => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
};
