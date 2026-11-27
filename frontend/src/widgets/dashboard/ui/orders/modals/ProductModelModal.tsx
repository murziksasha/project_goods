import type React from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product, ProductModelUpdatePayload } from '../../../../../entities/product';
import type { Sale, StockOrderLink } from '../../../../../entities/sale';
import { getStockOrderLinks } from '../../../../../entities/sale';
import type { PrintForm } from '../../../../../entities/settings';
import type { SupplierOrder } from '../../../../../entities/supplier-order';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings';
import { formatCurrency, formatDate } from '../../../../../shared/lib/format';
import { normalizeDecimalInput } from '../../../../../shared/lib/decimal';
import { getOrderLink, navigateDashboard } from '../../../../../shared/config/routing';
import { printWarehouseSerialLabels } from '../workspace/orders-workspace-shared';
import { Modal } from '../../../../../shared/ui/Modal';
import { Button } from '../../../../../shared/ui/Button';
import { CopyableValue } from '../../../../../shared/ui/CopyableValue';
import { PrinterIcon } from './PrinterIcon';
import {
  aggregateProductModelStock,
  buildProductModelSavePayload,
  buildProductModelSerialPurchases,
  getLatestBatchProduct,
  getActiveStockProductsByExactModelName,
  getProductModelInitialForm,
  getProductsByExactModelName,
  getReservedProductIdsOnOtherSales,
  type ProductModelClientOrder,
} from '../../../model/product-model';
import {
  buildSupplierOrdersByProductId,
  defaultStockStatusFilters,
  mergeSalesWithStockOrderLinks,
  type StockStatusFilter,
} from '../../../model/stock-balance';

type ProductModelSection = 'main' | 'prices' | 'stock';

const EMPTY_SALES: Sale[] = [];
const EMPTY_SUPPLIER_ORDERS: SupplierOrder[] = [];
const EMPTY_VALUE = '\u2014';

export interface ProductModelModalProps {
  name: string;
  products: Product[];
  sales?: Sale[];
  supplierOrders?: SupplierOrder[];
  currentSaleId?: string;
  warehouses: WarehouseItem[];
  /** Saved print forms; `null` while settings are loading (printing is blocked). */
  printForms: PrintForm[] | null;
  printProduct?: Product | null;
  selectedSerial?: { serialNumber: string; product: Product | null };
  stockStatuses?: readonly StockStatusFilter[];
  usePortal?: boolean;
  isSaving?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (payload: ProductModelUpdatePayload) => Promise<boolean>;
  onOpenSupplierOrder?: (supplierOrderId: string, itemIndex: number) => void;
  onOpenSaleCard?: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
};

const getInitialSelectedPrintIds = (
  serialPurchases: { productId: string; serialNumber: string }[],
  printProduct: Product | null,
) => {
  const printableIds = new Set(
    serialPurchases
      .filter((row) => row.serialNumber.trim())
      .map((row) => row.productId),
  );
  if (printProduct?.id && printableIds.has(printProduct.id)) {
    return [printProduct.id];
  }
  return [];
};

export const ProductModelModal: React.FC<ProductModelModalProps> = ({
  name,
  products,
  sales = EMPTY_SALES,
  supplierOrders = EMPTY_SUPPLIER_ORDERS,
  currentSaleId,
  warehouses,
  printForms,
  printProduct = null,
  selectedSerial,
  stockStatuses,
  usePortal = false,
  isSaving = false,
  readOnly = false,
  onClose,
  onSave,
  onOpenSupplierOrder,
  onOpenSaleCard,
}) => {
  const { t } = useTranslation();
  const selectedSerialPurchase = useMemo(() => {
    const product = selectedSerial?.product;
    if (!product) return null;
    return buildProductModelSerialPurchases(
      [product],
      new Set(),
      buildSupplierOrdersByProductId({ products: [product], supplierOrders }),
    )[0];
  }, [selectedSerial?.product, supplierOrders]);
  const stockLinkCandidates = useMemo(
    () =>
      getProductsByExactModelName(products, name).filter(
        (product) => product.quantity > 0,
      ),
    [name, products],
  );
  const [stockLinks, setStockLinks] = useState<StockOrderLink[]>([]);
  const stockLinkKey = stockLinkCandidates
    .map((product) => `${product.id}\u0000${product.serialNumber}`)
    .join('\u0001');
  const salesForModel = useMemo(
    () => mergeSalesWithStockOrderLinks(sales, stockLinks),
    [sales, stockLinks],
  );
  const matchingProducts = useMemo(
    () =>
      getActiveStockProductsByExactModelName(
        products,
        salesForModel,
        name,
        stockStatuses,
      ),
    [name, products, salesForModel, stockStatuses],
  );
  const latestBatchSource = useMemo(
    () =>
      stockStatuses !== undefined
        ? getActiveStockProductsByExactModelName(
            products,
            salesForModel,
            name,
            defaultStockStatusFilters,
          )
        : matchingProducts,
    [matchingProducts, name, products, salesForModel, stockStatuses],
  );
  const [form, setForm] = useState(() =>
    getProductModelInitialForm(matchingProducts),
  );
  const [openSections, setOpenSections] = useState<ProductModelSection[]>([
    'prices',
  ]);
  const [copyStatus, setCopyStatus] = useState('');
  const [printStatus, setPrintStatus] = useState('');
  const stockSummary = useMemo(
    () => aggregateProductModelStock(matchingProducts, warehouses),
    [matchingProducts, warehouses],
  );
  const reservedProductIds = useMemo(
    () =>
      getReservedProductIdsOnOtherSales(
        matchingProducts,
        salesForModel,
        currentSaleId,
      ),
    [currentSaleId, matchingProducts, salesForModel],
  );
  const supplierOrdersByProductId = useMemo(
    () =>
      buildSupplierOrdersByProductId({
        products: matchingProducts,
        supplierOrders,
      }),
    [matchingProducts, supplierOrders],
  );
  const serialPurchases = useMemo(
    () =>
      buildProductModelSerialPurchases(
        matchingProducts,
        reservedProductIds,
        supplierOrdersByProductId,
        salesForModel,
        latestBatchSource,
      ),
    [
      latestBatchSource,
      matchingProducts,
      reservedProductIds,
      salesForModel,
      supplierOrdersByProductId,
    ],
  );

  useEffect(() => {
    const productIds = stockLinkCandidates.map((product) => product.id);
    const serials = stockLinkCandidates
      .map((product) => product.serialNumber.trim())
      .filter(Boolean);
    if (productIds.length === 0 && serials.length === 0) {
      setStockLinks([]);
      return;
    }

    let isActive = true;
    void getStockOrderLinks({ productIds, serials })
      .then((response) => {
        if (!isActive) return;
        setStockLinks(response.links);
      })
      .catch(() => {
        if (!isActive) return;
        setStockLinks([]);
      });

    return () => {
      isActive = false;
    };
  }, [stockLinkCandidates, stockLinkKey]);

  const openClientOrder = (order: ProductModelClientOrder) => {
    if (onOpenSaleCard) {
      onOpenSaleCard({ id: order.saleId, kind: order.kind });
      return;
    }

    navigateDashboard({
      page: 'orders',
      ordersTab: order.kind === 'sale' ? 'sales' : 'orders',
      createOrder: null,
      saleId: order.saleId,
      accountingTab: null,
    });
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const printableSerialRows = useMemo(
    () => serialPurchases.filter((row) => row.serialNumber.trim()),
    [serialPurchases],
  );
  const printableSerialIdSet = useMemo(
    () => new Set(printableSerialRows.map((row) => row.productId)),
    [printableSerialRows],
  );
  const [selectedPrintProductIds, setSelectedPrintProductIds] = useState<
    string[]
  >(() => getInitialSelectedPrintIds(serialPurchases, printProduct));
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const latestBatchProduct = useMemo(
    () => getLatestBatchProduct(latestBatchSource),
    [latestBatchSource],
  );
  const matchingProductsById = useMemo(
    () => new Map(matchingProducts.map((product) => [product.id, product])),
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
  const selectedPrintableCount = selectedPrintProductIds.filter((id) =>
    printableSerialIdSet.has(id),
  ).length;
  const allPrintableSelected =
    printableSerialRows.length > 0 &&
    selectedPrintableCount === printableSerialRows.length;
  const somePrintableSelected =
    selectedPrintableCount > 0 && !allPrintableSelected;

  useEffect(() => {
    setForm(getProductModelInitialForm(matchingProducts));
  }, [matchingProducts]);

  useEffect(() => {
    setSelectedPrintProductIds(
      getInitialSelectedPrintIds(serialPurchases, printProduct),
    );
  }, [serialPurchases, printProduct]);

  useEffect(() => {
    if (!selectAllCheckboxRef.current) return;
    selectAllCheckboxRef.current.indeterminate = somePrintableSelected;
  }, [somePrintableSelected]);

  useEffect(() => {
    if (!copyStatus) return;

    const timeoutId = window.setTimeout(() => setCopyStatus(''), 1400);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  useEffect(() => {
    if (!printStatus) return;

    const timeoutId = window.setTimeout(() => setPrintStatus(''), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [printStatus]);

  const isSectionOpen = (section: ProductModelSection) =>
    openSections.includes(section);

  const toggleSection = (section: ProductModelSection) => {
    setOpenSections((current) =>
      current.includes(section)
        ? current.filter((item) => item !== section)
        : [...current, section],
    );
  };

  const togglePrintProduct = (productId: string) => {
    if (!printableSerialIdSet.has(productId)) return;

    setSelectedPrintProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const toggleAllPrintProducts = () => {
    if (allPrintableSelected) {
      setSelectedPrintProductIds([]);
      return;
    }

    setSelectedPrintProductIds(
      printableSerialRows.map((row) => row.productId),
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

  const printSelectedSerialNumbers = () => {
    if (selectedPrintableCount === 0) return;

    const items = selectedPrintProductIds
      .map((productId) => matchingProductsById.get(productId))
      .filter((product): product is Product => Boolean(product?.serialNumber.trim()))
      .map((product) => ({
        name: product.name,
        article: product.article,
        serialNumber: product.serialNumber,
      }));

    if (items.length === 0) return;

    void printWarehouseSerialLabels(
      items,
      printForms,
      t('catalog.productModel.printSerialTitle'),
    ).then((result) => {
      if (result === 'settings-loading') {
        setPrintStatus(t('warehouse.print.settingsLoading'));
      }
    });
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

  const printButtonTitle =
    selectedPrintableCount > 0
      ? t('catalog.productModel.printSelectedCount', {
          count: selectedPrintableCount,
        })
      : t('catalog.productModel.selectSerialsToPrint');

  return (
    <Modal
      isOpen
      usePortal={usePortal}
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
          {printStatus ? (
            <span className="product-model-copy-tooltip" role="status">
              {printStatus}
            </span>
          ) : null}
          {printableSerialRows.length > 0 ? (
            <button
              type="button"
              className="product-model-print-button"
              onClick={printSelectedSerialNumbers}
              disabled={selectedPrintableCount === 0}
              aria-label={printButtonTitle}
              title={printButtonTitle}
            >
              <PrinterIcon />
              {selectedPrintableCount > 0 ? (
                <span className="product-model-print-badge" aria-hidden="true">
                  {selectedPrintableCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      }
      footer={
        <footer className="catalog-edit-footer">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          {readOnly ? null : (
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
          )}
        </footer>
      }
    >
          {selectedSerial ? (
            <section
              className="product-model-selected-serial"
              aria-label={t('catalog.productModel.selectedSerialTitle')}
            >
              <h3>{t('catalog.productModel.selectedSerialTitle')}</h3>
              <dl className="product-model-selected-serial-info">
                <div>
                  <dt>{t('catalog.productModel.serialNumber')}</dt>
                  <dd>
                    <CopyableValue value={selectedSerial.serialNumber}>
                      {selectedSerial.serialNumber}
                    </CopyableValue>
                  </dd>
                </div>
                {selectedSerialPurchase ? (
                  <>
                    <div>
                      <dt>{t('catalog.productModel.purchasePrice')}</dt>
                      <dd>{formatCurrency(selectedSerialPurchase.price)}</dd>
                    </div>
                    <div>
                      <dt>{t('catalog.productModel.purchaseDate')}</dt>
                      <dd>{formatDate(selectedSerialPurchase.purchaseDate)}</dd>
                    </div>
                    <div>
                      <dt>{t('catalog.productModel.supplierOrder')}</dt>
                      <dd>
                        <CopyableValue value={selectedSerialPurchase.supplierOrderNumber}>
                          {selectedSerialPurchase.supplierOrderNumber || EMPTY_VALUE}
                        </CopyableValue>
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              {!selectedSerialPurchase ? (
                <p>{t('catalog.productModel.selectedSerialUnavailable')}</p>
              ) : null}
            </section>
          ) : null}
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
              <label className='field product-model-article-field'>
                <CopyableValue value={form.article}>
                  <span>{t('catalog.productModel.article')}</span>
                </CopyableValue>
                <input
                  value={form.article}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      article: event.target.value,
                    }))
                  }
                  disabled={!hasStockRows || isSaving || readOnly}
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
                  disabled={!hasStockRows || isSaving || readOnly}
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
                    disabled={!hasStockRows || isSaving || readOnly}
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
                    disabled={!hasStockRows || isSaving || readOnly}
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
                          <th className='product-model-serial-select-col product-model-serial-purchases-sticky-head'>
                            <input
                              ref={selectAllCheckboxRef}
                              type='checkbox'
                              checked={allPrintableSelected}
                              disabled={printableSerialRows.length === 0}
                              onChange={toggleAllPrintProducts}
                              aria-label={t(
                                'catalog.productModel.selectAllSerials',
                              )}
                            />
                          </th>
                          <th className='product-model-serial-purchases-sticky-head'>
                            {t('catalog.productModel.serialNumber')}
                          </th>
                          <th className='product-model-serial-purchases-sticky-head'>
                            {t('catalog.productModel.purchasePrice')}
                          </th>
                          <th className='product-model-serial-purchases-sticky-head'>
                            {t('catalog.productModel.purchaseDate')}
                          </th>
                          <th className='product-model-serial-purchases-sticky-head'>
                            {t('catalog.productModel.supplierOrder')}
                          </th>
                          <th className='product-model-serial-purchases-sticky-head'>
                            {t('catalog.productModel.clientOrder')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {serialPurchases.map((row) => {
                          const isPrintable = Boolean(row.serialNumber.trim());
                          const isChecked =
                            isPrintable &&
                            selectedPrintProductIds.includes(row.productId);
                          const isOpenedSerial =
                            printProduct?.id === row.productId;
                          const supplierOrderId = row.supplierOrderId;
                          const supplierOrderItemIndex =
                            row.supplierOrderItemIndex;
                          const canOpenSupplierOrder =
                            onOpenSupplierOrder &&
                            supplierOrderId &&
                            typeof supplierOrderItemIndex === 'number';
                          const rowClassName = [
                            row.isReserved
                              ? 'product-model-serial-row-reserved'
                              : row.isLatestBatch
                                ? 'product-model-serial-row-latest'
                                : '',
                            isChecked || isOpenedSerial
                              ? 'product-model-serial-row-selected'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ');

                          return (
                            <tr
                              key={row.productId}
                              className={rowClassName || undefined}
                            >
                              <td className='product-model-serial-select-col'>
                                <input
                                  type='checkbox'
                                  checked={isChecked}
                                  disabled={!isPrintable}
                                  onChange={() =>
                                    togglePrintProduct(row.productId)
                                  }
                                  aria-label={t(
                                    'catalog.productModel.selectSerialRow',
                                    {
                                      serial:
                                        row.serialNumber ||
                                        t('catalog.productModel.serialMissing'),
                                    },
                                  )}
                                />
                              </td>
                              <td>
                                <span className='product-model-serial-cell'>
                                  <CopyableValue value={row.serialNumber}>
                                    {row.serialNumber ||
                                      t('catalog.productModel.serialMissing')}
                                  </CopyableValue>
                                  {row.isLatestBatch ? (
                                    <span className='product-model-latest-batch-badge'>
                                      {t('catalog.productModel.latestBatchBadge')}
                                    </span>
                                  ) : null}
                                  {row.isReserved ? (
                                    <span className='product-model-reserved-badge'>
                                      {t('catalog.productModel.reservedBadge')}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                              <td>{formatCurrency(row.price)}</td>
                              <td>{formatDate(row.purchaseDate)}</td>
                              <td>
                                {row.supplierOrderNumber ? (
                                  <CopyableValue value={row.supplierOrderNumber}>
                                    {canOpenSupplierOrder ? (
                                      <button
                                        type='button'
                                        className='supplier-order-number-button'
                                        onClick={() => {
                                          if (
                                            !onOpenSupplierOrder ||
                                            !supplierOrderId ||
                                            typeof supplierOrderItemIndex !==
                                              'number'
                                          ) {
                                            return;
                                          }
                                          onOpenSupplierOrder(
                                            supplierOrderId,
                                            supplierOrderItemIndex,
                                          );
                                        }}
                                      >
                                        {row.supplierOrderNumber}
                                      </button>
                                    ) : (
                                      <span>{row.supplierOrderNumber}</span>
                                    )}
                                  </CopyableValue>
                                ) : (
                                  <span className='product-model-serial-empty'>
                                    {EMPTY_VALUE}
                                  </span>
                                )}
                              </td>
                              <td>
                                {row.clientOrders.length === 0 ? (
                                  <span className='product-model-serial-empty'>
                                    {EMPTY_VALUE}
                                  </span>
                                ) : (
                                  <span className='product-model-client-orders'>
                                    {row.clientOrders.map((order, index) => {
                                      const label =
                                        order.recordNumber.trim() ||
                                        order.saleId.slice(0, 8);
                                      return (
                                        <Fragment key={order.saleId}>
                                          {index > 0 ? ', ' : null}
                                          <CopyableValue value={label}>
                                            <a
                                              className='warehouse-link-badge'
                                              href={getOrderLink(
                                                order.saleId,
                                                order.kind,
                                              )}
                                              onClick={(event) => {
                                                if (
                                                  event.button !== 0 ||
                                                  event.metaKey ||
                                                  event.ctrlKey ||
                                                  event.shiftKey ||
                                                  event.altKey
                                                ) {
                                                  return;
                                                }
                                                event.preventDefault();
                                                openClientOrder(order);
                                              }}
                                            >
                                              {label}
                                            </a>
                                          </CopyableValue>
                                        </Fragment>
                                      );
                                    })}
                                  </span>
                                )}
                              </td>
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
