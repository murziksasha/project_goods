import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { PaginationPanel } from '../../../../shared/ui/PaginationPanel';
import {
  buildWarehouseInformationReport,
  type WarehouseInformationFilters,
  type WarehouseInformationView,
} from '../../model/warehouse-information';
import type { Product } from '../../../../entities/product/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import type { WarehouseItem } from '../../model/warehouse-panel';

const defaultFilters: WarehouseInformationFilters = {
  search: '',
  warehouseId: '',
  locationId: '',
  supplier: '',
  status: 'all',
  sort: 'quantity',
  sortDirection: 'desc',
  dateFrom: '',
  dateTo: '',
};

const formatList = (items: string[]) =>
  items.length > 0 ? items.join(', ') : '-';

const pageSizeDefault = 30;

const viewLabelKeys: Record<WarehouseInformationView, string> = {
  products: 'warehouse.information.views.products',
  locations: 'warehouse.information.views.locations',
  suppliers: 'warehouse.information.views.suppliers',
};

const toExcelSheetName = (value: string) =>
  value.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Report';

const downloadExcelFile = ({
  activeFilters,
  filename,
  headers,
  rows,
  title,
  viewLabel,
  templateLabels,
}: {
  activeFilters: string[];
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  title: string;
  viewLabel: string;
  templateLabels: {
    view: string;
    generated: string;
    filters: string;
    noFilters: string;
    noRowsFound: string;
  };
}) => {
  const generatedAt = new Date().toLocaleString();
  const filterText =
    activeFilters.length > 0
      ? activeFilters.join('; ')
      : templateLabels.noFilters;
  const dataRows =
    rows.length > 0
      ? rows
      : [[templateLabels.noRowsFound, ...Array(Math.max(headers.length - 1, 0)).fill('')]];
  const sheetData: Array<Array<string | number>> = [
    [title],
    [templateLabels.view, viewLabel],
    [templateLabels.generated, generatedAt],
    [templateLabels.filters, filterText],
    [],
    headers,
    ...dataRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, toExcelSheetName(viewLabel));
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const paginateRows = <T,>(rows: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
};

export const WarehouseInformationPanel = ({
  products,
  sales,
  warehouses,
  supplierOrders,
}: {
  products: Product[];
  sales: Sale[];
  warehouses: WarehouseItem[];
  supplierOrders: SupplierOrder[];
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<WarehouseInformationView>('products');
  const [filters, setFilters] =
    useState<WarehouseInformationFilters>(defaultFilters);
  const [draftDateFilters, setDraftDateFilters] = useState({
    dateFrom: defaultFilters.dateFrom,
    dateTo: defaultFilters.dateTo,
  });
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false);
  const [pageByView, setPageByView] = useState<
    Record<WarehouseInformationView, number>
  >({
    products: 1,
    locations: 1,
    suppliers: 1,
  });
  const [pageSizeByView, setPageSizeByView] = useState<
    Record<WarehouseInformationView, number>
  >({
    products: pageSizeDefault,
    locations: pageSizeDefault,
    suppliers: pageSizeDefault,
  });
  const currentPage = pageByView[view];
  const currentPageSize = pageSizeByView[view];
  const resetCurrentViewPage = () => {
    setPageByView((current) => ({ ...current, [view]: 1 }));
  };
  const updateFilters = (
    updater:
      | WarehouseInformationFilters
      | ((current: WarehouseInformationFilters) => WarehouseInformationFilters),
  ) => {
    setFilters(updater);
    resetCurrentViewPage();
  };
  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        id: warehouse.id,
        name: warehouse.name,
        isActive: warehouse.isActive,
      })),
    [warehouses],
  );
  const locationOptions = useMemo(
    () =>
      warehouses
        .filter(
          (warehouse) =>
            !filters.warehouseId || warehouse.id === filters.warehouseId,
        )
        .flatMap((warehouse) =>
          warehouse.locations.map((location) => ({
            id: location.id,
            name: location.name,
            warehouseName: warehouse.name,
          })),
        ),
    [filters.warehouseId, warehouses],
  );
  const supplierOptions = useMemo(
    () =>
      Array.from(
        new Set(
          supplierOrders
            .map((order) => order.supplierName.trim())
            .filter(Boolean),
        ),
      ).sort((first, second) => first.localeCompare(second)),
    [supplierOrders],
  );
  const visibleSupplierOptions = useMemo(() => {
    const supplierSearch = filters.supplier.trim().toLowerCase();
    if (!supplierSearch) return supplierOptions;
    return supplierOptions.filter((supplier) =>
      supplier.toLowerCase().includes(supplierSearch),
    );
  }, [filters.supplier, supplierOptions]);
  const report = useMemo(
    () =>
      buildWarehouseInformationReport({
        products,
        sales,
        warehouses,
        supplierOrders,
        filters,
      }),
    [filters, products, sales, supplierOrders, warehouses],
  );
  const rowCount =
    view === 'products'
      ? report.products.length
      : view === 'locations'
        ? report.locations.length
        : report.suppliers.length;
  const paginatedProducts = useMemo(
    () => paginateRows(report.products, currentPage, currentPageSize),
    [currentPage, currentPageSize, report.products],
  );
  const paginatedLocations = useMemo(
    () => paginateRows(report.locations, currentPage, currentPageSize),
    [currentPage, currentPageSize, report.locations],
  );
  const paginatedSuppliers = useMemo(
    () => paginateRows(report.suppliers, currentPage, currentPageSize),
    [currentPage, currentPageSize, report.suppliers],
  );

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(rowCount / currentPageSize));
    if (currentPage > pageCount) {
      setPageByView((current) => ({ ...current, [view]: pageCount }));
    }
  }, [currentPage, currentPageSize, rowCount, view]);

  const exportTemplateLabels = {
    view: t('warehouse.information.export.viewLabel'),
    generated: t('warehouse.information.export.generatedLabel'),
    filters: t('warehouse.information.export.filtersLabel'),
    noFilters: t('warehouse.information.export.noFilters'),
    noRowsFound: t('warehouse.information.export.noRowsFound'),
  };

  const getActiveFilterLabels = () => {
    const labels: string[] = [];
    const warehouse = warehouseOptions.find(
      (option) => option.id === filters.warehouseId,
    );
    const location = locationOptions.find(
      (option) => option.id === filters.locationId,
    );
    if (filters.search.trim()) {
      labels.push(
        t('warehouse.information.filters.searchActive', {
          value: filters.search.trim(),
        }),
      );
    }
    if (warehouse) {
      labels.push(
        t('warehouse.information.filters.warehouseActive', {
          name: warehouse.name,
        }),
      );
    }
    if (location) {
      labels.push(
        t('warehouse.information.filters.locationActive', {
          name: location.name,
        }),
      );
    }
    if (filters.supplier.trim()) {
      labels.push(
        t('warehouse.information.filters.supplierActive', {
          value: filters.supplier.trim(),
        }),
      );
    }
    if (filters.status !== 'all') {
      labels.push(
        t('warehouse.information.filters.statusActive', {
          value:
            filters.status === 'active'
              ? t('warehouse.information.filters.activeWarehouses')
              : t('warehouse.information.filters.inactiveWarehouses'),
        }),
      );
    }
    if (filters.dateFrom) {
      labels.push(
        t('warehouse.information.filters.dateFromActive', {
          value: filters.dateFrom,
        }),
      );
    }
    if (filters.dateTo) {
      labels.push(
        t('warehouse.information.filters.dateToActive', {
          value: filters.dateTo,
        }),
      );
    }
    const sortField =
      filters.sort === 'quantity'
        ? t('warehouse.information.filters.sortQuantity')
        : filters.sort === 'value'
          ? t('warehouse.information.filters.sortValue')
          : t('warehouse.information.filters.sortLatest');
    const sortDirection =
      filters.sortDirection === 'asc'
        ? t('warehouse.information.filters.ascending')
        : t('warehouse.information.filters.descending');
    labels.push(
      t('warehouse.information.filters.sortActive', {
        field: sortField,
        direction: sortDirection,
      }),
    );
    return labels;
  };

  const exportActiveView = () => {
    if (view === 'products') {
      downloadExcelFile({
        activeFilters: getActiveFilterLabels(),
        filename: t('warehouse.information.export.productsFilename'),
        title: t('warehouse.information.export.title'),
        viewLabel: t(viewLabelKeys[view]),
        templateLabels: exportTemplateLabels,
        headers: [
          t('warehouse.information.productsTable.exportColumns.product'),
          t('warehouse.information.productsTable.exportColumns.article'),
          t('warehouse.information.productsTable.exportColumns.units'),
          t('warehouse.information.productsTable.exportColumns.purchaseValue'),
          t('warehouse.information.productsTable.exportColumns.warehouses'),
          t('warehouse.information.productsTable.exportColumns.locations'),
          t('warehouse.information.productsTable.exportColumns.suppliers'),
          t('warehouse.information.productsTable.exportColumns.latestPurchase'),
        ],
        rows: report.products.map((row) => [
          row.name,
          row.article,
          row.units,
          row.value,
          formatList(row.warehouses),
          formatList(row.locations),
          formatList(row.suppliers),
          formatDate(row.latestPurchaseDate),
        ]),
      });
      return;
    }
    if (view === 'locations') {
      downloadExcelFile({
        activeFilters: getActiveFilterLabels(),
        filename: t('warehouse.information.export.locationsFilename'),
        title: t('warehouse.information.export.title'),
        viewLabel: t(viewLabelKeys[view]),
        templateLabels: exportTemplateLabels,
        headers: [
          t('warehouse.information.locationsTable.exportColumns.warehouse'),
          t('warehouse.information.locationsTable.exportColumns.status'),
          t('warehouse.information.locationsTable.exportColumns.location'),
          t('warehouse.information.locationsTable.exportColumns.units'),
          t('warehouse.information.locationsTable.exportColumns.uniqueProducts'),
          t('warehouse.information.locationsTable.exportColumns.purchaseValue'),
          t('warehouse.information.locationsTable.exportColumns.latestPurchase'),
        ],
        rows: report.locations.map((row) => [
          row.warehouseName,
          row.isWarehouseActive
            ? t('warehouse.common.active')
            : t('warehouse.common.inactive'),
          row.locationName,
          row.units,
          row.uniqueProducts,
          row.value,
          formatDate(row.latestPurchaseDate),
        ]),
      });
      return;
    }
    downloadExcelFile({
      activeFilters: getActiveFilterLabels(),
      filename: t('warehouse.information.export.suppliersFilename'),
      title: t('warehouse.information.export.title'),
      viewLabel: t(viewLabelKeys[view]),
      templateLabels: exportTemplateLabels,
      headers: [
        t('warehouse.information.suppliersTable.exportColumns.supplier'),
        t('warehouse.information.suppliersTable.exportColumns.units'),
        t('warehouse.information.suppliersTable.exportColumns.purchaseValue'),
        t('warehouse.information.suppliersTable.exportColumns.products'),
        t('warehouse.information.suppliersTable.exportColumns.warehouses'),
        t('warehouse.information.suppliersTable.exportColumns.latestPurchase'),
      ],
      rows: report.suppliers.map((row) => [
        row.supplierName,
        row.units,
        row.value,
        formatList(row.products),
        formatList(row.warehouses),
        formatDate(row.latestPurchaseDate),
      ]),
    });
  };

  const renderPagination = () => (
    <PaginationPanel
      totalItems={rowCount}
      page={currentPage}
      pageSize={currentPageSize}
      onPageChange={(nextPage) =>
        setPageByView((current) => ({ ...current, [view]: nextPage }))
      }
      onPageSizeChange={(nextPageSize) => {
        setPageSizeByView((current) => ({
          ...current,
          [view]: nextPageSize,
        }));
        setPageByView((current) => ({ ...current, [view]: 1 }));
      }}
    />
  );

  return (
    <section className='warehouse-information'>
      <div className='finance-information-header warehouse-information-header'>
        <div>
          <p className='section-label'>
            {t('warehouse.information.sectionLabel')}
          </p>
          <h2>{t('warehouse.information.title')}</h2>
        </div>
        <div className='finance-information-status'>
          <span>
            {t('warehouse.information.unitsStatus', {
              count: report.summary.totalUnits,
            })}
          </span>
          <span>{formatCurrency(report.summary.purchaseValue)}</span>
        </div>
      </div>

      <div className='finance-report-grid finance-report-grid-wide warehouse-information-summary'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.stockUnits')}
          </span>
          <strong>{report.summary.totalUnits}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.positions')}
          </span>
          <strong>{report.summary.uniquePositions}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.purchaseValue')}
          </span>
          <strong>{formatCurrency(report.summary.purchaseValue)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.activeWarehouses')}
          </span>
          <strong>{report.summary.activeWarehouses}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.inactiveWithStock')}
          </span>
          <strong>{report.summary.inactiveWarehousesWithStock}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>
            {t('warehouse.information.summary.locationsWithStock')}
          </span>
          <strong>{report.summary.locationsWithStock}</strong>
        </article>
      </div>

      <div className='warehouse-information-controls'>
        <div className='warehouse-search-modes'>
          {(
            ['products', 'locations', 'suppliers'] as WarehouseInformationView[]
          ).map((key) => (
            <button
              key={key}
              type='button'
              className={
                view === key
                  ? 'warehouse-mode-button warehouse-mode-button-active'
                  : 'warehouse-mode-button'
              }
              onClick={() => {
                setView(key);
                setPageByView((current) => ({ ...current, [key]: 1 }));
              }}
            >
              {t(viewLabelKeys[key])}
            </button>
          ))}
        </div>
        <button
          type='button'
          className='secondary-button'
          onClick={exportActiveView}
        >
          {t('warehouse.information.exportToFile')}
        </button>
      </div>

      <div className='warehouse-information-toolbar'>
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isDateFilterOpen}
          onClick={() => setIsDateFilterOpen((current) => !current)}
        >
          {t('warehouse.information.filters.date')}
          {filters.dateFrom || filters.dateTo ? (
            <span className='toolbar-filter-count'>
              {filters.dateFrom && filters.dateTo ? '2' : '1'}
            </span>
          ) : null}
        </button>
      </div>

      <section
        className={
          isDateFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type='button'
          className='orders-filter-panel-close'
          aria-label={t('warehouse.information.filters.closeDateFiltersAriaLabel')}
          onClick={() => setIsDateFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>{t('warehouse.information.filters.dateFrom')}</span>
            <input
              type='date'
              value={draftDateFilters.dateFrom}
              onChange={(event) =>
                setDraftDateFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className='orders-filter-field'>
            <span>{t('warehouse.information.filters.dateTo')}</span>
            <input
              type='date'
              value={draftDateFilters.dateTo}
              onChange={(event) =>
                setDraftDateFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() =>
              updateFilters((current) => ({
                ...current,
                dateFrom: draftDateFilters.dateFrom,
                dateTo: draftDateFilters.dateTo,
              }))
            }
          >
            {t('warehouse.common.apply')}
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDraftDateFilters({ dateFrom: '', dateTo: '' });
              updateFilters((current) => ({
                ...current,
                dateFrom: '',
                dateTo: '',
              }));
            }}
          >
            {t('warehouse.common.clear')}
          </button>
        </div>
      </section>

      <div className='warehouse-information-filters'>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.search')}</span>
          <input
            value={filters.search}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder={t('warehouse.information.filters.searchPlaceholder')}
          />
        </label>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.warehouse')}</span>
          <select
            value={filters.warehouseId}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                warehouseId: event.target.value,
                locationId: '',
              }))
            }
          >
            <option value=''>
              {t('warehouse.information.filters.allWarehouses')}
            </option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.isActive === false
                  ? t('warehouse.information.filters.warehouseInactiveSuffix', {
                      name: warehouse.name,
                    })
                  : warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.location')}</span>
          <select
            value={filters.locationId}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                locationId: event.target.value,
              }))
            }
          >
            <option value=''>
              {t('warehouse.information.filters.allLocations')}
            </option>
            {locationOptions.map((location) => (
              <option
                key={`${location.warehouseName}-${location.id}`}
                value={location.id}
              >
                {filters.warehouseId
                  ? location.name
                  : `${location.warehouseName} / ${location.name}`}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field warehouse-supplier-combobox'>
          <span>{t('warehouse.information.filters.supplier')}</span>
          <input
            value={filters.supplier}
            onFocus={() => setIsSupplierMenuOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsSupplierMenuOpen(false), 120);
            }}
            onChange={(event) => {
              updateFilters((current) => ({
                ...current,
                supplier: event.target.value,
              }));
              setIsSupplierMenuOpen(true);
            }}
            placeholder={t('warehouse.information.filters.allSuppliers')}
          />
          {isSupplierMenuOpen ? (
            <div className='warehouse-supplier-combobox-menu'>
              <button
                type='button'
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  updateFilters((current) => ({ ...current, supplier: '' }));
                  setIsSupplierMenuOpen(false);
                }}
              >
                {t('warehouse.information.filters.allSuppliers')}
              </button>
              {visibleSupplierOptions.length === 0 ? (
                <span>{t('warehouse.information.filters.noSuppliersFound')}</span>
              ) : (
                visibleSupplierOptions.map((supplier) => (
                  <button
                    key={supplier}
                    type='button'
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      updateFilters((current) => ({
                        ...current,
                        supplier,
                      }));
                      setIsSupplierMenuOpen(false);
                    }}
                  >
                    {supplier}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </label>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.status')}</span>
          <select
            value={filters.status}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                status: event.target
                  .value as WarehouseInformationFilters['status'],
              }))
            }
          >
            <option value='all'>
              {t('warehouse.information.filters.allStatuses')}
            </option>
            <option value='active'>
              {t('warehouse.information.filters.activeWarehouses')}
            </option>
            <option value='inactive'>
              {t('warehouse.information.filters.inactiveWarehouses')}
            </option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.sort')}</span>
          <select
            value={filters.sort}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                sort: event.target
                  .value as WarehouseInformationFilters['sort'],
              }))
            }
          >
            <option value='quantity'>
              {t('warehouse.information.filters.sortQuantity')}
            </option>
            <option value='value'>
              {t('warehouse.information.filters.sortValue')}
            </option>
            <option value='latest'>
              {t('warehouse.information.filters.sortLatest')}
            </option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>{t('warehouse.information.filters.direction')}</span>
          <select
            value={filters.sortDirection}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                sortDirection: event.target
                  .value as WarehouseInformationFilters['sortDirection'],
              }))
            }
          >
            <option value='desc'>
              {t('warehouse.information.filters.descending')}
            </option>
            <option value='asc'>
              {t('warehouse.information.filters.ascending')}
            </option>
          </select>
        </label>
      </div>

      {view === 'products' ? (
        <div className='catalog-table-wrap'>
          <table className='catalog-table warehouse-information-table'>
            <thead>
              <tr>
                <th>
                  {t('warehouse.information.productsTable.columns.product')}
                </th>
                <th>
                  {t('warehouse.information.productsTable.columns.article')}
                </th>
                <th>{t('warehouse.information.productsTable.columns.units')}</th>
                <th>{t('warehouse.information.productsTable.columns.value')}</th>
                <th>
                  {t('warehouse.information.productsTable.columns.warehouses')}
                </th>
                <th>
                  {t('warehouse.information.productsTable.columns.locations')}
                </th>
                <th>
                  {t('warehouse.information.productsTable.columns.suppliers')}
                </th>
                <th>{t('warehouse.information.productsTable.columns.latest')}</th>
              </tr>
            </thead>
            <tbody>
              {report.products.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {t('warehouse.information.productsTable.empty')}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((row) => (
                  <tr key={row.id}>
                    <td className='catalog-name-cell'>{row.name}</td>
                    <td>{row.article}</td>
                    <td>{row.units}</td>
                    <td>{formatCurrency(row.value)}</td>
                    <td>{formatList(row.warehouses)}</td>
                    <td>{formatList(row.locations)}</td>
                    <td>{formatList(row.suppliers)}</td>
                    <td>{formatDate(row.latestPurchaseDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      ) : null}

      {view === 'locations' ? (
        <div className='catalog-table-wrap'>
          <table className='catalog-table warehouse-information-table'>
            <thead>
              <tr>
                <th>
                  {t('warehouse.information.locationsTable.columns.warehouse')}
                </th>
                <th>
                  {t('warehouse.information.locationsTable.columns.status')}
                </th>
                <th>
                  {t('warehouse.information.locationsTable.columns.location')}
                </th>
                <th>{t('warehouse.information.locationsTable.columns.units')}</th>
                <th>
                  {t('warehouse.information.locationsTable.columns.products')}
                </th>
                <th>{t('warehouse.information.locationsTable.columns.value')}</th>
                <th>
                  {t('warehouse.information.locationsTable.columns.latest')}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.locations.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    {t('warehouse.information.locationsTable.empty')}
                  </td>
                </tr>
              ) : (
                paginatedLocations.map((row) => (
                  <tr key={row.id}>
                    <td className='catalog-name-cell'>{row.warehouseName}</td>
                    <td>
                      <span
                        className={
                          row.isWarehouseActive
                            ? 'receipt-status receipt-status-received'
                            : 'receipt-status receipt-status-cancelled'
                        }
                      >
                        {row.isWarehouseActive
                          ? t('warehouse.common.active')
                          : t('warehouse.common.inactive')}
                      </span>
                    </td>
                    <td>{row.locationName}</td>
                    <td>{row.units}</td>
                    <td>{row.uniqueProducts}</td>
                    <td>{formatCurrency(row.value)}</td>
                    <td>{formatDate(row.latestPurchaseDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      ) : null}

      {view === 'suppliers' ? (
        <div className='catalog-table-wrap'>
          <table className='catalog-table warehouse-information-table'>
            <thead>
              <tr>
                <th>
                  {t('warehouse.information.suppliersTable.columns.supplier')}
                </th>
                <th>{t('warehouse.information.suppliersTable.columns.units')}</th>
                <th>{t('warehouse.information.suppliersTable.columns.value')}</th>
                <th>
                  {t('warehouse.information.suppliersTable.columns.products')}
                </th>
                <th>
                  {t('warehouse.information.suppliersTable.columns.warehouses')}
                </th>
                <th>
                  {t('warehouse.information.suppliersTable.columns.latest')}
                </th>
              </tr>
            </thead>
            <tbody>
              {report.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {t('warehouse.information.suppliersTable.empty')}
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map((row) => (
                  <tr key={row.id}>
                    <td className='catalog-name-cell'>{row.supplierName}</td>
                    <td>{row.units}</td>
                    <td>{formatCurrency(row.value)}</td>
                    <td>{formatList(row.products)}</td>
                    <td>{formatList(row.warehouses)}</td>
                    <td>{formatDate(row.latestPurchaseDate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {renderPagination()}
        </div>
      ) : null}
    </section>
  );
};