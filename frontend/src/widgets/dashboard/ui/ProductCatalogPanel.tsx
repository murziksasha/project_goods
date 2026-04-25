import { useEffect, useState } from 'react';
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

type CatalogTab = 'products' | 'services';

type ProductCatalogPanelProps = {
  products: Product[];
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
  onEdit: (product: Product) => void;
  onArchiveProduct: (product: Product) => void;
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
};

const tabs: Array<{ key: CatalogTab; label: string }> = [
  { key: 'products', label: 'Products' },
  { key: 'services', label: 'Services' },
];

export const ProductCatalogPanel = ({
  products,
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
  onEdit,
  onArchiveProduct,
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
}: ProductCatalogPanelProps) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceCatalogItem | null>(null);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const isProductsTab = activeTab === 'products';
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

  const editProduct = (product: Product) => {
    onEdit(product);
    setSelectedProduct(product);
  };

  const editService = (service: ServiceCatalogItem) => {
    onServiceEdit(service);
    setSelectedService(service);
  };

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
            value={isProductsTab ? currentSearchValue : currentServiceSearchValue}
            placeholder={
              isProductsTab
                ? 'Product name, article or serial'
                : 'Service name or note'
            }
            onChange={(event) =>
              isProductsTab
                ? onSearchChange(event.target.value)
                : onServiceSearchChange(event.target.value)
            }
          />
          <button type="button">Find</button>
        </div>
        <div className="catalog-toolbar-actions">
          {isProductsTab ? (
            <span className="muted-copy">Product creation moves to Warehouses.</span>
          ) : (
            <button type="button" className="orders-create-button" onClick={openServiceForm}>
              Create service
            </button>
          )}
        </div>
      </div>

      {!isProductsTab && isServiceFormOpen ? (
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
        <ProductsTable
          products={products}
          isLoading={isLoading}
          searchQuery={searchQuery}
          onEdit={editProduct}
        />
      ) : (
        <ServicesTable
          services={services}
          isLoading={isServicesLoading}
          searchQuery={serviceSearchQuery}
          onEdit={editService}
        />
      )}

      {selectedProduct ? (
        <CatalogProductModal
          product={selectedProduct}
          form={productForm}
          isSaving={isProductSaving}
          isEditing={isProductEditing}
          onChange={onProductChange}
          onSubmit={onProductSubmit}
          onClose={() => {
            onProductCancelEdit();
            setSelectedProduct(null);
          }}
          onArchive={() => {
            onArchiveProduct(selectedProduct);
            setSelectedProduct(null);
          }}
          catalogNumber={catalogNumbers.get(selectedProduct.id) ?? 0}
        />
      ) : null}

      {selectedService ? (
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
          catalogNumber={catalogNumbers.get(selectedService.id) ?? 0}
        />
      ) : null}
    </section>
  );
};

type ProductsTableProps = {
  products: Product[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (product: Product) => void;
};

const ProductsTable = ({
  products,
  isLoading,
  searchQuery,
  onEdit,
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
            <th><input type="checkbox" aria-label="Select all products" /></th>
            <th>Name</th>
            <th>Article</th>
            <th>Serial</th>
            <th>Retail</th>
            <th>Purchase</th>
            <th>Total</th>
            <th>Free</th>
            <th>Warehouse</th>
            <th>Warranty</th>
            <th>Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td><input type="checkbox" aria-label={`Select ${product.name}`} /></td>
              <td>
                <button
                  type="button"
                  className="catalog-name-button"
                  onClick={() => onEdit(product)}
                >
                  {product.name}
                </button>
                {!product.isActive ? <span className="catalog-inactive-badge">Inactive</span> : null}
              </td>
              <td>{product.article}</td>
              <td>{product.serialNumber}</td>
              <td>{formatCurrency(product.salePriceOptions[0] ?? product.price)}</td>
              <td>{formatCurrency(product.price)}</td>
              <td>{product.quantity} pcs</td>
              <td>{product.freeQuantity} pcs</td>
              <td>{product.purchasePlace || '-'}</td>
              <td>{product.warrantyPeriod} mo</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>
                <div className="catalog-row-actions">
                  <button type="button" className="danger-button" onClick={() => onEdit(product)}>
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

type ServicesTableProps = {
  services: ServiceCatalogItem[];
  isLoading: boolean;
  searchQuery: string;
  onEdit: (service: ServiceCatalogItem) => void;
};

const ServicesTable = ({
  services,
  isLoading,
  searchQuery,
  onEdit,
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
              <td>{index + 1}</td>
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

const CatalogProductModal = ({
  product,
  catalogNumber,
  form,
  isSaving,
  isEditing,
  onChange,
  onSubmit,
  onClose,
  onArchive,
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
        <button type="button" className="primary-button" onClick={() => void saveAndClose()} disabled={isSaving || !isEditing}>
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
