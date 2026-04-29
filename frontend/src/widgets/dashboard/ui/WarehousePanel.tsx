import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductFormValues } from '../../../entities/product/model/types';
import { ProductForm } from '../../../features/manage-product/ui/ProductForm';
import { formatDate } from '../../../shared/lib/format';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';

type WarehouseTab =
  | 'stock'
  | 'receipts'
  | 'expenses'
  | 'transfers'
  | 'logistics'
  | 'inventory'
  | 'settings';

type WarehouseSearchMode = 'serial' | 'name' | 'warehouse';

type WarehousePanelProps = {
  products: Product[];
  isLoading: boolean;
  productForm: ProductFormValues;
  isProductSaving: boolean;
  isProductEditing: boolean;
  onProductChange: <K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) => void;
  onProductSubmit: () => void;
  onProductCancelEdit: () => void;
  onProductEdit: (product: Product) => void;
  onProductDelete: (product: Product) => void;
};

const tabs: Array<{ key: WarehouseTab; label: string; badge?: string }> = [
  { key: 'stock', label: 'Stock balances' },
  { key: 'receipts', label: 'Receipts', badge: '10' },
  { key: 'expenses', label: 'Expenses', badge: '4' },
  { key: 'transfers', label: 'Transfers' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'settings', label: 'Settings' },
];

const searchModes: Array<{ key: WarehouseSearchMode; label: string }> = [
  { key: 'serial', label: 'By serial #' },
  { key: 'name', label: 'By name' },
  { key: 'warehouse', label: 'By warehouse' },
];
const paginationPageSizeOptions = [10, 30, 50, 100];

const getSearchText = (product: Product, mode: WarehouseSearchMode) => {
  if (mode === 'serial') return product.serialNumber;
  if (mode === 'warehouse') return product.purchasePlace;

  return [product.name, product.article, product.note].join(' ');
};

export const WarehousePanel = ({
  products,
  isLoading,
  productForm,
  isProductSaving,
  isProductEditing,
  onProductChange,
  onProductSubmit,
  onProductCancelEdit,
  onProductEdit,
  onProductDelete,
}: WarehousePanelProps) => {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('stock');
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<WarehouseSearchMode>('serial');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;

    return products.filter((product) =>
      getSearchText(product, searchMode).toLowerCase().includes(normalizedQuery),
    );
  }, [products, query, searchMode]);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [currentPage, filteredProducts, pageSize]);

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredProducts.length / pageSize),
    );
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, filteredProducts.length, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchMode]);

  return (
    <section className="panel warehouse-panel">
      <div className="warehouse-tabs" role="tablist" aria-label="Warehouse sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              tab.key === activeTab
                ? 'warehouse-tab warehouse-tab-active'
                : 'warehouse-tab'
            }
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            {tab.badge ? <strong>{tab.badge}</strong> : null}
          </button>
        ))}
      </div>

      <div className="warehouse-toolbar">
        <button type="button" className="toolbar-square-button" aria-label="Previous page">
          ‹
        </button>
        <span className="warehouse-page-number">1</span>
        <button type="button" className="toolbar-square-button" aria-label="Next page">
          ›
        </button>
        <button type="button" className="toolbar-square-button" aria-label="Filters">
          ⚙
        </button>
        <button type="button" className="toolbar-filter-button">
          Filter
        </button>
        <div className="orders-search-group warehouse-search-group">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search stock"
          />
          <button type="button">Find</button>
        </div>
        <div className="warehouse-search-modes">
          {searchModes.map((mode) => (
            <button
              key={mode.key}
              type="button"
              className={
                mode.key === searchMode
                  ? 'warehouse-mode-button warehouse-mode-button-active'
                  : 'warehouse-mode-button'
              }
              onClick={() => {
                setSearchMode(mode.key);
                setCurrentPage(1);
              }}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'receipts' ? (
        <div className="warehouse-receipt">
          <ProductForm
            form={productForm}
            isSaving={isProductSaving}
            isEditing={isProductEditing}
            onChange={onProductChange}
            onSubmit={onProductSubmit}
            onCancelEdit={onProductCancelEdit}
          />
        </div>
      ) : null}

      {activeTab === 'stock' || activeTab === 'receipts' ? (
        <>
          <StockTable
            products={paginatedProducts}
            isLoading={isLoading}
            onEdit={onProductEdit}
            onDelete={onProductDelete}
          />
          <PaginationPanel
            totalItems={filteredProducts.length}
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={paginationPageSizeOptions}
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
          />
        </>
      ) : (
        <p className="empty-state">This warehouse section is ready for the next workflow.</p>
      )}
    </section>
  );
};

type StockTableProps = {
  products: Product[];
  isLoading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

const StockTable = ({
  products,
  isLoading,
  onEdit,
  onDelete,
}: StockTableProps) => {
  if (isLoading) {
    return <p className="empty-state">Loading warehouse stock...</p>;
  }

  if (products.length === 0) {
    return <p className="empty-state">No stock rows found.</p>;
  }

  return (
    <div className="catalog-table-wrap">
      <table className="catalog-table warehouse-stock-table">
        <thead>
          <tr>
            <th><input type="checkbox" aria-label="Select all stock rows" /></th>
            <th>Name</th>
            <th>Serial #</th>
            <th>Article</th>
            <th>Date</th>
            <th>Qty</th>
            <th>Retail</th>
            <th>Purchase</th>
            <th>Warehouse</th>
            <th>Location</th>
            <th>Client order</th>
            <th>Supplier order</th>
            <th>Supplier</th>
            <th>Note</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td><input type="checkbox" aria-label={`Select ${product.name}`} /></td>
              <td className="catalog-name-cell">{product.name}</td>
              <td>{product.serialNumber}</td>
              <td>{product.article}</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>{product.quantity} pcs</td>
              <td>{product.salePriceOptions[0] ?? product.price}</td>
              <td>{product.price}</td>
              <td>{product.purchasePlace || 'Main warehouse'}</td>
              <td>{product.freeQuantity > 0 ? 'A' : '-'}</td>
              <td>-</td>
              <td>-</td>
              <td>{product.purchasePlace || '-'}</td>
              <td>{product.note || '-'}</td>
              <td>
                <div className="catalog-row-actions">
                  <button type="button" className="ghost-button" onClick={() => onEdit(product)}>
                    Edit
                  </button>
                  <button type="button" className="danger-button" onClick={() => onDelete(product)}>
                    ×
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
