import { useMemo, useState } from 'react';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import {
  buildWarehouseInformationReport,
  escapeCsvCell,
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
};

const formatList = (items: string[]) =>
  items.length > 0 ? items.join(', ') : '-';

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const content = rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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

  const exportActiveView = () => {
    if (view === 'products') {
      downloadCsv('warehouse-products.csv', [
        [
          'Product',
          'Article',
          'Units',
          'Purchase value',
          'Warehouses',
          'Locations',
          'Suppliers',
          'Latest purchase',
        ],
        ...report.products.map((row) => [
          row.name,
          row.article,
          row.units,
          row.value,
          formatList(row.warehouses),
          formatList(row.locations),
          formatList(row.suppliers),
          row.latestPurchaseDate ?? '',
        ]),
      ]);
      return;
    }
    if (view === 'locations') {
      downloadCsv('warehouse-locations.csv', [
        [
          'Warehouse',
          'Status',
          'Location',
          'Units',
          'Unique products',
          'Purchase value',
          'Latest purchase',
        ],
        ...report.locations.map((row) => [
          row.warehouseName,
          row.isWarehouseActive ? 'Active' : 'Inactive',
          row.locationName,
          row.units,
          row.uniqueProducts,
          row.value,
          row.latestPurchaseDate ?? '',
        ]),
      ]);
      return;
    }
    downloadCsv('warehouse-suppliers.csv', [
      [
        'Supplier',
        'Units',
        'Purchase value',
        'Products',
        'Warehouses',
        'Latest purchase',
      ],
      ...report.suppliers.map((row) => [
        row.supplierName,
        row.units,
        row.value,
        formatList(row.products),
        formatList(row.warehouses),
        row.latestPurchaseDate ?? '',
      ]),
    ]);
  };

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
                onClick={() => setView(key)}
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
          Export CSV
        </button>
      </div>

      <div className='warehouse-information-filters'>
        <label className='orders-filter-field'>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({
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
              setFilters((current) => ({
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
              setFilters((current) => ({
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
        <label className='orders-filter-field'>
          <span>Supplier</span>
          <select
            value={filters.supplier}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                supplier: event.target.value,
              }))
            }
          >
            <option value=''>All suppliers</option>
            {supplierOptions.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
        </label>
        <label className='orders-filter-field'>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
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
              setFilters((current) => ({
                ...current,
                sort: event.target
                  .value as WarehouseInformationFilters['sort'],
              }))
            }
          >
            <option value='quantity'>Quantity</option>
            <option value='value'>Purchase value</option>
            <option value='latest'>Latest purchase</option>
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
                report.products.map((row) => (
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
                report.locations.map((row) => (
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
                report.suppliers.map((row) => (
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
        </div>
      ) : null}
    </section>
  );
};
