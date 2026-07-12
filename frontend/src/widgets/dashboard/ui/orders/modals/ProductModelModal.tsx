import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductModelUpdatePayload } from '../../../../../entities/product/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { PrintForm } from '../../../../../entities/settings/model/types';
import { defaultPrintForms } from '../../../../../entities/settings/model/printForms';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import { formatCurrency, formatDate } from '../../../../../shared/lib/format';
import { normalizeDecimalInput } from '../../../../../shared/lib/decimal';
import { printWarehouseSerialLabels } from '../workspace/orders-workspace-shared';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';
import { PrinterIcon } from './PrinterIcon';
import {
  aggregateProductModelStock,
  buildProductModelSavePayload,
  buildProductModelSerialPurchases,
  getLatestBatchProduct,
  getActiveStockProductsByExactModelName,
  getProductModelInitialForm,
} from '../../../model/product-model';

type ProductModelSection = 'main' | 'prices' | 'stock';

const EMPTY_SALES: Sale[] = [];

type ProductModelModalProps = {
  name: string;
  products: Product[];
  sales?: Sale[];
  warehouses: WarehouseItem[];
  printForms?: PrintForm[];
  printProduct?: Product | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (payload: ProductModelUpdatePayload) => Promise<boolean>;
};

export const ProductModelModal = ({
  name,
  products,
  sales = EMPTY_SALES,
  warehouses,
  printForms = defaultPrintForms,
  printProduct = null,
  isSaving = false,
  onClose,
  onSave,
}: ProductModelModalProps) => {
  const { t } = useTranslation();
  const matchingProducts = useMemo(
    () => getActiveStockProductsByExactModelName(products, sales, name),
    [name, products, sales],
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
  const serialPurchases = useMemo(
    () => buildProductModelSerialPurchases(matchingProducts),
    [matchingProducts],
  );
  const latestBatchProduct = useMemo(
    () => getLatestBatchProduct(matchingProducts),
    [matchingProducts],
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
      setCopyStatus(t('catalog.productModel.copied'));
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
      setCopyStatus(
        didCopy
          ? t('catalog.productModel.copied')
          : t('catalog.productModel.copyFailed'),
      );
    }
  };

  const printSelectedSerialNumber = () => {
    if (!printProduct?.serialNumber.trim()) return;

    void printWarehouseSerialLabels(
      [
        {
          name: printProduct.name,
          article: printProduct.article,
          serialNumber: printProduct.serialNumber,
        },
      ],
      printForms,
      t('catalog.productModel.printSerialTitle'),
    );
  };

  const renderSectionHeader = (section: ProductModelSection) => {
    const isOpen = isSectionOpen(section);

    return (
      <button
        type='button'
        className='product-model-section-toggle'
        onClick={() => toggleSection(section)}
        aria-expanded={isOpen}
      >
        <span>{t(`catalog.productModel.sections.${section}`)}</span>
        <span aria-hidden='true'>{isOpen ? '^' : 'v'}</span>
      </button>
    );
  };

  return (
    <Modal
      isOpen
      title={name}
      subtitle={t('catalog.productModel.title')}
      onClose={onClose}
      closeLabel={t('catalog.modals.close')}
      className="product-model-modal"
      closeOnBackdrop={!isSaving}
      closeOnEscape={!isSaving}
      headerActions={
        <div className="product-model-header-actions">
          <button
            type="button"
            className="product-model-copy-button"
            onClick={() => void copyName()}
            aria-label={t('catalog.productModel.copyProductName')}
            title={copyStatus || t('catalog.productModel.copyProductName')}
          >
            <span aria-hidden="true">{t('catalog.productModel.copy')}</span>
          </button>
          {copyStatus ? (
            <span className="product-model-copy-tooltip">{copyStatus}</span>
          ) : null}
          {printProduct ? (
            <button
              type="button"
              className="toolbar-square-button order-print-icon-button product-model-print-button"
              onClick={printSelectedSerialNumber}
              disabled={!printProduct.serialNumber.trim()}
              aria-label={t('catalog.productModel.printSerialNumber')}
              title={t('catalog.productModel.printSerialNumber')}
            >
              <PrinterIcon />
            </button>
          ) : null}
        </div>
      }
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const saved = await onSave(
                buildProductModelSavePayload(name, form),
              );
              if (saved) onClose();
            }}
            disabled={!hasStockRows || isSaving}
          >
            {isSaving
              ? t('catalog.productModel.saving')
              : t('catalog.productModel.saveModel')}
          </Button>
        </footer>
      }
    >
          {!hasStockRows ? (
            <p className='empty-state'>
              {t('catalog.productModel.noStockRows')}
            </p>
          ) : null}

          {renderSectionHeader('main')}
          {isSectionOpen('main') ? (
            <div className='product-model-section-body'>
              <label className='field'>
                <span>{t('catalog.productModel.name')}</span>
                <input value={name} readOnly />
              </label>
              <label className='field'>
                <span>{t('catalog.productModel.article')}</span>
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
                <span>{t('catalog.productModel.note')}</span>
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

          {renderSectionHeader('prices')}
          {isSectionOpen('prices') ? (
            <div className='product-model-section-body'>
              <div className='form-grid'>
                <label className='field'>
                  <span>{t('catalog.productModel.retailPrice')}</span>
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
                  <span>{t('catalog.productModel.wholesalePrice')}</span>
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
              </div>
              {hasStockRows ? (
                <section className='product-model-serial-purchases'>
                  <div className='product-model-serial-purchases-header'>
                    <strong>{t('catalog.productModel.serialPurchasesTitle')}</strong>
                    {latestBatchProduct ? (
                      <span className='product-model-purchase-meta'>
                        {t('catalog.productModel.latestBatchSummary', {
                          price: formatCurrency(latestBatchProduct.price),
                          date: formatDate(
                            latestBatchProduct.purchaseDate ??
                              latestBatchProduct.createdAt,
                          ),
                        })}
                      </span>
                    ) : null}
                  </div>
                  <div className='product-model-serial-purchases-table-wrap'>
                    <table className='catalog-table product-model-serial-purchases-table'>
                      <thead>
                        <tr>
                          <th>{t('catalog.productModel.serialNumber')}</th>
                          <th>{t('catalog.productModel.purchasePrice')}</th>
                          <th>{t('catalog.productModel.purchaseDate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serialPurchases.map((row) => {
                          const isSelected = printProduct?.id === row.productId;
                          const rowClassName = [
                            row.isLatestBatch
                              ? 'product-model-serial-row-latest'
                              : '',
                            isSelected ? 'product-model-serial-row-selected' : '',
                          ]
                            .filter(Boolean)
                            .join(' ');

                          return (
                            <tr
                              key={row.productId}
                              className={rowClassName || undefined}
                            >
                              <td>
                                <span className='product-model-serial-cell'>
                                  {row.serialNumber ||
                                    t('catalog.productModel.serialMissing')}
                                  {row.isLatestBatch ? (
                                    <span className='product-model-latest-batch-badge'>
                                      {t('catalog.productModel.latestBatchBadge')}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td>{formatCurrency(row.price)}</td>
                              <td>{formatDate(row.purchaseDate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className='muted-copy'>
                    {t('catalog.productModel.purchasePriceReadOnlyHint')}
                  </p>
                  <p className='muted-copy'>
                    {t('catalog.productModel.matchingStockRows', {
                      count: matchingProducts.length,
                    })}
                  </p>
                </section>
              ) : null}
            </div>
          ) : null}

          {renderSectionHeader('stock')}
          {isSectionOpen('stock') ? (
            <div className='product-model-section-body'>
              <div className='product-model-summary'>
                <div>
                  <span>{t('catalog.productModel.total')}</span>
                  <strong>{totalStock}</strong>
                </div>
                <div>
                  <span>{t('catalog.productModel.free')}</span>
                  <strong>{freeStock}</strong>
                </div>
                <div>
                  <span>{t('catalog.productModel.reserved')}</span>
                  <strong>{reservedStock}</strong>
                </div>
              </div>

              <table className='catalog-table product-model-stock-table'>
                <thead>
                  <tr>
                    <th>{t('catalog.productModel.warehouse')}</th>
                    <th>{t('catalog.productModel.location')}</th>
                    <th>{t('catalog.productModel.total')}</th>
                    <th>{t('catalog.productModel.free')}</th>
                    <th>{t('catalog.productModel.reserved')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        {t('catalog.productModel.noStockRowsTable')}
                      </td>
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
    </Modal>
  );
};
