import type { ClientDevice } from '../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../entities/supplier/model/types';
import type { ServiceCatalogItem } from '../../../entities/service-catalog/model/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
export const SuppliersTable = ({ suppliers, searchQuery, onSelectSupplier }: { suppliers: Supplier[]; searchQuery: string; onSelectSupplier: (supplier: Supplier) => void }) => {
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

type ProductsTableProps = {
  products: ClientDevice[];
  isLoading: boolean;
  searchQuery: string;
  rowStartIndex: number;
  onSelectDevice: (device: ClientDevice) => void;
};

export const ProductsTable = ({
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

export const CatalogProductsTable = ({
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

export const ServicesTable = ({
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



