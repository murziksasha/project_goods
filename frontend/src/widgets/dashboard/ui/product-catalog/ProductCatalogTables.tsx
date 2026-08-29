import { useTranslation } from 'react-i18next';
import type { ClientDevice } from '../../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type { ServiceCatalogItem } from '../../../../entities/service-catalog/model/types';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { EmptyState } from '../../../../shared/ui/EmptyState';
import { StatusBadge } from '../../../../shared/ui/StatusBadge';
import { TableSkeleton } from '../../../../shared/ui/TableSkeleton';
import { CatalogCopyableName } from './CatalogCopyableName';

const CatalogNote = ({ note }: { note: string }) => {
  const trimmed = note.trim();
  return (
    <span className="catalog-note-cell" title={trimmed || undefined}>
      {trimmed || '-'}
    </span>
  );
};

const CatalogStatus = ({ isActive }: { isActive: boolean }) => {
  const { t } = useTranslation();
  return (
    <StatusBadge
      label={isActive ? t('catalog.filters.active') : t('catalog.filters.inactive')}
      tone={isActive ? 'success' : 'gray'}
    />
  );
};

export const SuppliersTable = ({
  suppliers,
  searchQuery,
  rowStartIndex,
  onSelectSupplier,
}: {
  suppliers: Supplier[];
  searchQuery: string;
  rowStartIndex: number;
  onSelectSupplier: (supplier: Supplier) => void;
}) => {
  const { t } = useTranslation();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (suppliers.length === 0) {
    return (
      <EmptyState>
        {normalizedQuery
          ? t('catalog.tables.noSuppliersFound')
          : t('catalog.tables.noSuppliersYet')}
      </EmptyState>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-compact catalog-card-table">
        <thead>
          <tr>
            <th className="catalog-col-id">{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th className="catalog-col-phone">{t('catalog.tables.columns.phone')}</th>
            <th>{t('catalog.tables.columns.note')}</th>
            <th className="catalog-col-status">{t('catalog.tables.columns.status')}</th>
            <th className="catalog-col-date">{t('catalog.tables.columns.created')}</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier, index) => (
            <tr
              key={supplier.id}
              className="catalog-table-row"
              onClick={() => onSelectSupplier(supplier)}
            >
              <td data-label={t('catalog.tables.columns.id')}>
                {rowStartIndex + index + 1}
              </td>
              <td data-label={t('catalog.tables.columns.name')}>
                <CatalogCopyableName
                  name={supplier.name}
                  onOpen={() => onSelectSupplier(supplier)}
                />
              </td>
              <td data-label={t('catalog.tables.columns.phone')}>
                <a
                  href={`tel:${supplier.phone}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  {supplier.phone}
                </a>
              </td>
              <td data-label={t('catalog.tables.columns.note')}>
                <CatalogNote note={supplier.note} />
              </td>
              <td data-label={t('catalog.tables.columns.status')}>
                <CatalogStatus isActive={supplier.isActive} />
              </td>
              <td data-label={t('catalog.tables.columns.created')}>
                {formatDate(supplier.createdAt)}
              </td>
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
        columns={6}
        label={t('catalog.tables.loadingDevices')}
      />
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState>
        {searchQuery ? t('catalog.tables.noDevicesFound') : t('catalog.tables.noDevicesYet')}
      </EmptyState>
    );
  }

  return (
    <div className="catalog-table-wrap catalog-card-table-wrap">
      <table className="catalog-table catalog-table-compact catalog-card-table">
        <thead>
          <tr>
            <th className="catalog-col-id">{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.note')}</th>
            <th className="catalog-col-usage">{t('catalog.tables.columns.usage')}</th>
            <th className="catalog-col-status">{t('catalog.tables.columns.status')}</th>
            <th className="catalog-col-date">{t('catalog.tables.columns.date')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr
              key={product.id}
              className="catalog-table-row"
              onClick={() => onSelectDevice(product)}
            >
              <td data-label={t('catalog.tables.columns.id')}>
                {rowStartIndex + index + 1}
              </td>
              <td data-label={t('catalog.tables.columns.name')}>
                <CatalogCopyableName
                  name={product.name}
                  onOpen={() => onSelectDevice(product)}
                />
              </td>
              <td data-label={t('catalog.tables.columns.note')}>
                <CatalogNote note={product.note} />
              </td>
              <td data-label={t('catalog.tables.columns.usage')}>
                {product.usageCount ?? 0}
              </td>
              <td data-label={t('catalog.tables.columns.status')}>
                <CatalogStatus isActive={product.isActive} />
              </td>
              <td data-label={t('catalog.tables.columns.date')}>
                {formatDate(product.createdAt)}
              </td>
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
        columns={6}
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
            <th className="catalog-col-id">{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th>{t('catalog.tables.columns.note')}</th>
            <th className="catalog-col-usage">{t('catalog.tables.columns.usage')}</th>
            <th className="catalog-col-status">{t('catalog.tables.columns.status')}</th>
            <th className="catalog-col-date">{t('catalog.tables.columns.lastSeen')}</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr
              key={product.id}
              className="catalog-table-row"
              onClick={() => onSelectProduct(product)}
            >
              <td data-label={t('catalog.tables.columns.id')}>
                {rowStartIndex + index + 1}
              </td>
              <td data-label={t('catalog.tables.columns.name')}>
                <CatalogCopyableName
                  name={product.name}
                  onOpen={() => onSelectProduct(product)}
                />
              </td>
              <td data-label={t('catalog.tables.columns.note')}>
                <CatalogNote note={product.note} />
              </td>
              <td data-label={t('catalog.tables.columns.usage')}>
                {product.usageCount ?? 0}
              </td>
              <td data-label={t('catalog.tables.columns.status')}>
                <CatalogStatus isActive={product.isActive} />
              </td>
              <td data-label={t('catalog.tables.columns.lastSeen')}>
                {formatDate(product.lastSeenAt || product.createdAt)}
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
        columns={6}
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
            <th className="catalog-col-id">{t('catalog.tables.columns.id')}</th>
            <th>{t('catalog.tables.columns.name')}</th>
            <th className="catalog-col-price">{t('catalog.tables.columns.price')}</th>
            <th>{t('catalog.tables.columns.note')}</th>
            <th className="catalog-col-status">{t('catalog.tables.columns.status')}</th>
            <th className="catalog-col-date">{t('catalog.tables.columns.updated')}</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service, index) => (
            <tr
              key={service.id}
              className="catalog-table-row"
              onClick={() => onEdit(service)}
            >
              <td data-label={t('catalog.tables.columns.id')}>
                {rowStartIndex + index + 1}
              </td>
              <td data-label={t('catalog.tables.columns.name')}>
                <CatalogCopyableName
                  name={service.name}
                  onOpen={() => onEdit(service)}
                />
              </td>
              <td data-label={t('catalog.tables.columns.price')}>
                {formatCurrency(service.price)}
              </td>
              <td data-label={t('catalog.tables.columns.note')}>
                <CatalogNote note={service.note} />
              </td>
              <td data-label={t('catalog.tables.columns.status')}>
                <CatalogStatus isActive={service.isActive} />
              </td>
              <td data-label={t('catalog.tables.columns.updated')}>
                {formatDate(service.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
