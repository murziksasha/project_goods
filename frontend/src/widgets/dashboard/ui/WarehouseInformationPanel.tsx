import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import {
  buildWarehouseInformationReport,
  type WarehouseInformationFilters,
  type WarehouseInformationView,
} from '../model/warehouse-information';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { WarehouseItem } from '../model/warehouse-panel';

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

const viewLabels: Record<WarehouseInformationView, string> = {
  products: 'Products',
  locations: 'Locations',
  suppliers: 'Suppliers',
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const downloadWordFile = ({
  activeFilters,
  filename,
  headers,
  rows,
  title,
  view,
}: {
  activeFilters: string[];
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  title: string;
  view: WarehouseInformationView;
}) => {
  const generatedAt = new Date().toLocaleString();
  const filterText =
    activeFilters.length > 0 ? activeFilters.join('; ') : 'No filters';
  const tableHead = headers
    .map((header) => `<th>${escapeHtml(header)}</th>`)
    .join('');
  const tableRows =
    rows.length > 0
      ? rows
          .map(
            (row) =>
              `<tr>${row
                .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                .join('')}</tr>`,
          )
          .join('')
      : `<tr><td colspan="${headers.length}">No rows found.</td></tr>`;
  const content = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2937; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    p { margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #cfd8e3; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #edf2f7; font-weight: 700; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p><strong>View:</strong> ${escapeHtml(viewLabels[view])}</p>
  <p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
  <p><strong>Filters:</strong> ${escapeHtml(filterText)}</p>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([content], {
    type: 'application/msword;charset=utf-8',
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

  const getActiveFilterLabels = () => {
    const labels: string[] = [];
    const warehouse = warehouseOptions.find(
      (option) => option.id === filters.warehouseId,
    );
    const location = locationOptions.find(
      (option) => option.id === filters.locationId,
    );
    if (filters.search.trim()) labels.push(`Search: ${filters.search.trim()}`);
    if (warehouse) labels.push(`Warehouse: ${warehouse.name}`);
    if (location) labels.push(`Location: ${location.name}`);
    if (filters.supplier.trim()) {
      labels.push(`Supplier: ${filters.supplier.trim()}`);
    }
    if (filters.status !== 'all') {
      labels.push(
        `Status: ${filters.status === 'active' ? 'Active warehouses' : 'Inactive warehouses'}`,
      );
    }
    if (filters.dateFrom) labels.push(`Date from: ${filters.dateFrom}`);
    if (filters.dateTo) labels.push(`Date to: ${filters.dateTo}`);
    labels.push(
      `Sort: ${
        filters.sort === 'quantity'
          ? 'Quantity'
          : filters.sort === 'value'
            ? 'Purchase value'
            : 'Date'
      } ${filters.sortDirection === 'asc' ? 'ascending' : 'descending'}`,
    );
    return labels;
  };

  const exportActiveView = () => {
    if (view === 'products') {
      downloadWordFile({
        activeFilters: getActiveFilterLabels(),
        filename: 'warehouse-products.doc',
        title: 'Warehouse Information',
        view,
        headers: [
          'Product',
          'Article',
          'Units',
          'Purchase value',
          'Warehouses',
          'Locations',
          'Suppliers',
          'Latest purchase',
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
      downloadWordFile({
        activeFilters: getActiveFilterLabels(),
        filename: 'warehouse-locations.doc',
        title: 'Warehouse Information',
        view,
        headers: [
          'Warehouse',
          'Status',
          'Location',
          'Units',
          'Unique products',
          'Purchase value',
          'Latest purchase',
        ],
        rows: report.locations.map((row) => [
          row.warehouseName,
          row.isWarehouseActive ? 'Active' : 'Inactive',
          row.locationName,
          row.units,
          row.uniqueProducts,
          row.value,
          formatDate(row.latestPurchaseDate),
        ]),
      });
      return;
    }
    downloadWordFile({
      activeFilters: getActiveFilterLabels(),
      filename: 'warehouse-suppliers.doc',
      title: 'Warehouse Information',
      view,
      headers: [
        'Supplier',
        'Units',
        'Purchase value',
        'Products',
        'Warehouses',
        'Latest purchase',
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
          <p className='section-label'>Warehouse analytics</p>
          <h2>Information</h2>
        </div>
        <div className='finance-information-status'>
          <span>{`${report.summary.totalUnits} units`}</span>
          <span>{formatCurrency(report.summary.purchaseValue)}</span>
        </div>
      </div>

      <div className='finance-report-grid finance-report-grid-wide warehouse-information-summary'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Stock units</span>
          <strong>{report.summary.totalUnits}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Positions</span>
          <strong>{report.summary.uniquePositions}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Purchase value</span>
          <strong>{formatCurrency(report.summary.purchaseValue)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Active warehouses</span>
          <strong>{report.summary.activeWarehouses}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Inactive with stock</span>
          <strong>{report.summary.inactiveWarehousesWithStock}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Locations with stock</span>
          <strong>{report.summary.locationsWithStock}</strong>
        </article>
      </div>

      <div className='warehouse-information-controls'>
        <div className='warehouse-search-modes'>
          {([
            ['products', 'Products'],
            ['locations', 'Locations'],
            ['suppliers', 'Suppliers'],
          ] as Array<[WarehouseInformationView, string]>).map(
            ([key, label]) => (
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
                {label}
              </button>
            ),
          )}
        </div>
        <button
          type='button'
          className='secondary-button'
          onClick={exportActiveView}
        >
          Export to file
        </button>
      </div>

      <div className='warehouse-information-toolbar'>
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isDateFilterOpen}
          onClick={() => setIsDateFilterOpen((current) => !current)}
        >
          Date
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
          aria-label='Close date filters panel'
          onClick={() => setIsDateFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Date from</span>
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
            <span>Date to</span>
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
            Apply
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
            Clear
          </button>
        </div>
      </section>

      <div className='warehouse-information-filters'>
        <label className='orders-filter-field'>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder='Product, serial, warehouse, supplier'
          />
        </label>
        <label className='orders-filter-field'>
          <span>Warehouse</span>
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
            <option value=''>All warehouses</option>
            {warehouseOptions.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.isActive === false
                  ? `${warehouse.name} (inactive)`
                  : warehouse.name}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Location</span>
          <select
            value={filters.locationId}
            onChange={(event) =>
              updateFilters((current) => ({
                ...current,
                locationId: event.target.value,
              }))
            }
          >
            <option value=''>All locations</option>
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
          <span>Supplier</span>
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
            placeholder='All suppliers'
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
                All suppliers
              </button>
              {visibleSupplierOptions.length === 0 ? (
                <span>No suppliers found.</span>
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
          <span>Status</span>
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
            <option value='all'>All statuses</option>
            <option value='active'>Active warehouses</option>
            <option value='inactive'>Inactive warehouses</option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Sort</span>
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
            <option value='quantity'>Quantity</option>
            <option value='value'>Purchase value</option>
            <option value='latest'>Date</option>
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Direction</span>
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
            <option value='desc'>Descending</option>
            <option value='asc'>Ascending</option>
          </select>
        </label>
      </div>

      {view === 'products' ? (
        <div className='catalog-table-wrap'>
          <table className='catalog-table warehouse-information-table'>
            <thead>
              <tr>
                <th>Product</th>
                <th>Article</th>
                <th>Units</th>
                <th>Value</th>
                <th>Warehouses</th>
                <th>Locations</th>
                <th>Suppliers</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {report.products.length === 0 ? (
                <tr>
                  <td colSpan={8}>No product rows found.</td>
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
                <th>Warehouse</th>
                <th>Status</th>
                <th>Location</th>
                <th>Units</th>
                <th>Products</th>
                <th>Value</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {report.locations.length === 0 ? (
                <tr>
                  <td colSpan={7}>No location rows found.</td>
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
                        {row.isWarehouseActive ? 'Active' : 'Inactive'}
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
                <th>Supplier</th>
                <th>Units</th>
                <th>Value</th>
                <th>Products</th>
                <th>Warehouses</th>
                <th>Latest</th>
              </tr>
            </thead>
            <tbody>
              {report.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6}>No supplier rows found.</td>
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
