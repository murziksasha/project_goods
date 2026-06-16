import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductModelUpdatePayload } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { formatCurrency } from '../../../shared/lib/format';
import { normalizeDecimalInput, parseDecimal } from '../../../shared/lib/decimal';
import { printSerialNumbers } from '../../../shared/lib/serialPrint';
import { PrinterIcon } from './PrinterIcon';
import {
  aggregateProductModelStock,
  buildProductModelSavePayload,
  getProductModelInitialForm,
  getProductsByExactModelName,
} from '../model/product-model';

type ProductModelSection = 'main' | 'prices' | 'stock';

type ProductModelModalProps = {
  name: string;
  products: Product[];
  warehouses: WarehouseItem[];
  printProduct?: Product | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: ProductModelUpdatePayload) => Promise<boolean>;
};

export const ProductModelModal = ({
  name,
  products,
  warehouses,
  printProduct = null,
  isSaving = false,
  onClose,
  onSave,
}: ProductModelModalProps) => {
  const matchingProducts = useMemo(
    () => getProductsByExactModelName(products, name),
    [name, products],
  );
  const [form, setForm] = useState(() =>
    getProductModelInitialForm(matchingProducts),
  );
  const [openSections, setOpenSections] = useState<ProductModelSection[]>([
    'prices',
  ]);
  const [copyStatus, setCopyStatus] = useState('');
  const stockSummary = useMemo(
    () => aggregateProductModelStock(matchingProducts, warehouses),
    [matchingProducts, warehouses],
  );
  const hasStockRows = matchingProducts.length > 0;
  const totalStock = matchingProducts.reduce(
    (total, product) => total + product.quantity,
    0,
  );
  const freeStock = matchingProducts.reduce(
    (total, product) => total + product.freeQuantity,
    0,
  );
  const reservedStock = matchingProducts.reduce(
    (total, product) => total + product.reservedQuantity,
    0,
  );

  useEffect(() => {
    setForm(getProductModelInitialForm(matchingProducts));
  }, [matchingProducts]);

  useLockBodyScroll();

  useEffect(() => {
    if (!copyStatus) return;

    const timeoutId = window.setTimeout(() => setCopyStatus(''), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  const isSectionOpen = (section: ProductModelSection) =>
    openSections.includes(section);

  const toggleSection = (section: ProductModelSection) => {
    setOpenSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopyStatus('Copied');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = name;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const didCopy = document.execCommand('copy');
      textarea.remove();
      setCopyStatus(didCopy ? 'Copied' : 'Copy failed');
    }
  };

  const printSelectedSerialNumber = () => {
    if (!printProduct?.serialNumber.trim()) return;

    printSerialNumbers(
      [
        {
          name: printProduct.name,
          article: printProduct.article,
          serialNumber: printProduct.serialNumber,
        },
      ],
      'Warehouse serial number',
    );
  };

  const renderSectionHeader = (
    section: ProductModelSection,
    label: string,
  ) => {
    const isOpen = isSectionOpen(section);

    return (
      <button
        type='button'
        className='product-model-section-toggle'
        onClick={() => toggleSection(section)}
        aria-expanded={isOpen}
      >
        <span>{label}</span>
        <span aria-hidden='true'>{isOpen ? '^' : 'v'}</span>
      </button>
    );
  };

  return (
    <div
      className='modal-backdrop'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className='catalog-edit-modal product-model-modal'
        role='dialog'
        aria-modal='true'
        aria-label='Product model'
      >
        <header className='catalog-edit-header'>
          <div className='catalog-edit-title'>
            <button
              type='button'
              className='product-model-copy-label'
              onClick={() => void copyName()}
              title={copyStatus || 'Copy product name'}
            >
              Product model
            </button>
            <div className='product-model-title-row'>
              <h2>
                <button
                  type='button'
                  className='product-model-title-button'
                  onClick={() => void copyName()}
                  title={copyStatus || 'Copy product name'}
                >
                  {name}
                </button>
              </h2>
              <button
                type='button'
                className='product-model-copy-button'
                onClick={() => void copyName()}
                aria-label='Copy product name'
                title={copyStatus || 'Copy product name'}
              >
                <span aria-hidden='true'>Copy</span>
              </button>
              {copyStatus ? (
                <span className='product-model-copy-tooltip'>
                  {copyStatus}
                </span>
              ) : null}
              {printProduct ? (
                <button
                  type='button'
                  className='toolbar-square-button order-print-icon-button product-model-print-button'
                  onClick={printSelectedSerialNumber}
                  disabled={!printProduct.serialNumber.trim()}
                  aria-label='Print serial number'
                  title='Print serial number'
                >
                  <PrinterIcon />
                </button>
              ) : null}
            </div>
          </div>
          <button
            type='button'
            className='create-order-close'
            onClick={onClose}
            aria-label='Close'
          >
            &times;
          </button>
        </header>

        <div className='catalog-edit-body'>
          {!hasStockRows ? (
            <p className='empty-state'>
              No stock rows exist for this exact product name.
            </p>
          ) : null}

          {renderSectionHeader('main', 'MAIN INFORMATION')}
          {isSectionOpen('main') ? (
            <div className='product-model-section-body'>
              <label className='field'>
                <span>Name</span>
                <input value={name} readOnly />
              </label>
              <label className='field'>
                <span>Article</span>
                <input
                  value={form.article}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      article: event.target.value,
                    }))
                  }
                  disabled={!hasStockRows || isSaving}
                />
              </label>
              <label className='field'>
                <span>Note</span>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                  disabled={!hasStockRows || isSaving}
                />
              </label>
            </div>
          ) : null}

          {renderSectionHeader('prices', 'PRICES')}
          {isSectionOpen('prices') ? (
            <div className='product-model-section-body'>
              <div className='form-grid'>
                <label className='field'>
                  <span>Retail price</span>
                  <input
                    value={form.retailPrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        retailPrice: normalizeDecimalInput(event.target.value),
                      }))
                    }
                    disabled={!hasStockRows || isSaving}
                  />
                </label>
                <label className='field'>
                  <span>Wholesale price</span>
                  <input
                    value={form.wholesalePrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        wholesalePrice: normalizeDecimalInput(event.target.value),
                      }))
                    }
                    disabled={!hasStockRows || isSaving}
                  />
                </label>
                <label className='field'>
                  <span>Purchase price</span>
                  <input
                    value={form.purchasePrice}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        purchasePrice: normalizeDecimalInput(event.target.value),
                      }))
                    }
                    disabled={!hasStockRows || isSaving}
                  />
                </label>
              </div>
              {hasStockRows ? (
                <p className='muted-copy'>
                  {`Last batch price: ${formatCurrency(
                    parseDecimal(form.purchasePrice) || 0,
                  )}. Matching stock rows: ${matchingProducts.length}.`}
                </p>
              ) : null}
            </div>
          ) : null}

          {renderSectionHeader('stock', 'STOCK SUMMARY')}
          {isSectionOpen('stock') ? (
            <div className='product-model-section-body'>
              <div className='product-model-summary'>
                <div>
                  <span>Total</span>
                  <strong>{totalStock}</strong>
                </div>
                <div>
                  <span>Free</span>
                  <strong>{freeStock}</strong>
                </div>
                <div>
                  <span>Reserved</span>
                  <strong>{reservedStock}</strong>
                </div>
              </div>

              <table className='catalog-table product-model-stock-table'>
                <thead>
                  <tr>
                    <th>Warehouse</th>
                    <th>Location</th>
                    <th>Total</th>
                    <th>Free</th>
                    <th>Reserved</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No stock rows.</td>
                    </tr>
                  ) : (
                    stockSummary.map((item) => (
                      <tr key={`${item.warehouseId}-${item.locationId}`}>
                        <td>{item.warehouseName}</td>
                        <td>{item.locationName}</td>
                        <td>{item.totalStock}</td>
                        <td>{item.freeStock}</td>
                        <td>{item.reservedStock}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <footer className='catalog-edit-footer'>
          <button
            type='button'
            className='secondary-button'
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type='button'
            className='primary-button'
            onClick={async () => {
              const saved = await onSave(buildProductModelSavePayload(name, form));
              if (saved) onClose();
            }}
            disabled={!hasStockRows || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save model'}
          </button>
        </footer>
      </section>
    </div>
  );
};

const useLockBodyScroll = () => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
};
