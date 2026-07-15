import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type { ServiceCatalogItem } from '../../../../entities/service-catalog/model/types';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { TableSkeleton } from '../../../../shared/ui/TableSkeleton';

export const SuppliersTable = ({
  suppliers,
  searchQuery,
  onSelectSupplier,
}: {
  suppliers: Supplier[];
  searchQuery: string;
  onSelectSupplier: (supplier: Supplier) => void;
}) => {
  const { t } = useTranslation();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (suppliers.length === 0) {
    return (
      <p className="empty-state">
        {normalizedQuery
          ? t('catalog.tables.noSuppliersFound')
          : t('catalog.tables.noSuppliersYet')}
      </p>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-compact catalog-card-table">
        <thead>
          <tr>
            <th>{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.phone')}</th>
            <th>{t('catalog.tables.columns.status')}</th>
            <th>{t('catalog.tables.columns.created')}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td data-label={t('catalog.tables.columns.id')}>{supplier.id.slice(-6)}</td>
              <td data-label={t('catalog.tables.columns.name')}>
                <button type="button" className="catalog-name-button" onClick={() => onSelectSupplier(supplier)}>
                  {supplier.name}
                </button>
              </td>
              <td data-label={t('catalog.tables.columns.phone')}>{supplier.phone}</td>
              <td data-label={t('catalog.tables.columns.status')}>
                {supplier.isActive ? t('catalog.filters.active') : t('catalog.filters.inactive')}
              </td>
              <td data-label={t('catalog.tables.columns.created')}>{formatDate(supplier.createdAt)}</td>
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
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <TableSkeleton
        rows={6}
        columns={4}
        label={t('catalog.tables.loadingProducts')}
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState>
        {searchQuery ? t('catalog.tables.noProductsFound') : t('catalog.tables.noProductsYet')}
      </EmptyState>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-compact catalog-card-table">
        <thead>
          <tr>
            <th>{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.activity')}</th>
            <th>{t('catalog.tables.columns.date')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td data-label={t('catalog.tables.columns.id')}>{rowStartIndex + index + 1}</td>
              <td data-label={t('catalog.tables.columns.name')}>
                <button type="button" className="catalog-name-button" onClick={() => onSelectDevice(product)}>
                  {product.name}
                </button>
              </td>
              <td data-label={t('catalog.tables.columns.activity')}>
                {product.isActive ? t('catalog.filters.active') : t('catalog.filters.inactive')}
              </td>
              <td data-label={t('catalog.tables.columns.date')}>{formatDate(product.createdAt)}</td>
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
  rowStartIndex,
  onSelectProduct,
}: {
  products: CatalogProduct[];
  isLoading: boolean;
  searchQuery: string;
  rowStartIndex: number;
  onSelectProduct: (product: CatalogProduct) => void;
}) => {
  const { t } = useTranslation();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (isLoading) {
    return (
      <TableSkeleton
        rows={6}
        columns={4}
        label={t('catalog.tables.loadingProducts')}
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState>
        {normalizedQuery ? t('catalog.tables.noProductsFound') : t('catalog.tables.noProductsYet')}
      </EmptyState>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-compact catalog-card-table">
        <thead>
          <tr>
            <th>{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.activity')}</th>
            <th>{t('catalog.tables.columns.date')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={product.id}>
              <td data-label={t('catalog.tables.columns.id')}>{rowStartIndex + index + 1}</td>
              <td data-label={t('catalog.tables.columns.name')}>
                <button
                  type="button"
                  className="catalog-name-button"
                  onClick={() => onSelectProduct(product)}
                >
                  {product.name}
                </button>
              </td>
              <td data-label={t('catalog.tables.columns.activity')}>
                {product.isActive ? t('catalog.filters.active') : t('catalog.filters.inactive')}
              </td>
              <td data-label={t('catalog.tables.columns.date')}>{formatDate(product.createdAt)}</td>
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
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <TableSkeleton
        rows={6}
        columns={4}
        label={t('catalog.tables.loadingServices')}
      />
    );
  }

  if (services.length === 0) {
    return (
      <EmptyState>
        {searchQuery ? t('catalog.tables.noServicesFound') : t('catalog.tables.noServicesYet')}
      </EmptyState>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-services catalog-card-table">
        <thead>
          <tr>
            <th>{t('catalog.tables.columns.id')}</th>
            <th>
              <input type="checkbox" aria-label={t('catalog.tables.selectAllServices')} />
            </th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.price')}</th>
            <th>{t('catalog.tables.columns.note')}</th>
            <th>{t('catalog.tables.columns.updated')}</th>
            <th>{t('catalog.tables.columns.action')}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service, index) => (
            <tr key={service.id}>
              <td data-label={t('catalog.tables.columns.id')}>{rowStartIndex + index + 1}</td>
              <td data-label={t('catalog.tables.columns.select')}>
                <input
                  type="checkbox"
                  aria-label={t('catalog.tables.selectService', { name: service.name })}
                />
              </td>
              <td data-label={t('catalog.tables.columns.name')}>
                <button
                  type="button"
                  className="catalog-name-button"
                  onClick={() => onEdit(service)}
                >
                  {service.name}
                </button>
                {!service.isActive ? (
                  <span className="catalog-inactive-badge">{t('catalog.tables.inactiveBadge')}</span>
                ) : null}
              </td>
              <td data-label={t('catalog.tables.columns.price')}>{formatCurrency(service.price)}</td>
              <td data-label={t('catalog.tables.columns.note')}>{service.note || '-'}</td>
              <td data-label={t('catalog.tables.columns.updated')}>{formatDate(service.updatedAt)}</td>
              <td data-label={t('catalog.tables.columns.action')}>
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