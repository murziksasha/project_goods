import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { getStockSupplierLabel } from '../model/stock-balance';
import {
  getReceiptPaymentStatusClass,
  getWarehouseBadgeAccentStyle,
  type ProductWarehouseMeta,
  type ReceiptRow,
  type ReceiptsColumnKey,
  type ServiceCenter,
  type StockColumnKey,
  type SupplierOrderLink,
  type WarehouseItem,
} from '../model/warehouse-panel';

export const ReceiptsTable = ({
  receipts,
  visibleColumns,
  onOpenOrder,
  onOpenProduct,
  onOpenSupplier,
  onToggleFavorite,
  canManageSupplierOrders,
}: {
  receipts: ReceiptRow[];
  visibleColumns: ReceiptsColumnKey[];
  onOpenOrder: (receipt: ReceiptRow) => void;
  onOpenProduct: (receipt: ReceiptRow) => void;
  onOpenSupplier: (receipt: ReceiptRow) => void;
  onToggleFavorite: (receipt: ReceiptRow) => void;
  canManageSupplierOrders: boolean;
}) => {
  const { t } = useTranslation();

  if (receipts.length === 0)
    return (
      <p className='empty-state'>{t('warehouse.tables.receipts.empty')}</p>
    );
  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-receipts-table'>
        <thead>
          <tr>
            {visibleColumns.map((columnKey) => (
              <th key={columnKey}>
                {t(`warehouse.tables.receipts.columns.${columnKey}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              {visibleColumns.map((columnKey) => (
                <td key={`${receipt.id}-${columnKey}`}>
                  {columnKey === 'number' ? (
                    <div className='supplier-order-number-cell'>
                      {receipt.supplierOrderId ? (
                        <button
                          type='button'
                          className={
                            receipt.supplierOrderIsFavorite
                              ? 'supplier-order-row-star supplier-order-row-star-active'
                              : 'supplier-order-row-star'
                          }
                          aria-label={
                            receipt.supplierOrderIsFavorite
                              ? t(
                                  'warehouse.tables.receipts.removeStarAriaLabel',
                                  { number: receipt.number },
                                )
                              : t('warehouse.tables.receipts.starAriaLabel', {
                                  number: receipt.number,
                                })
                          }
                          aria-pressed={receipt.supplierOrderIsFavorite === true}
                          disabled={!canManageSupplierOrders}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleFavorite(receipt);
                          }}
                        >
                          {receipt.supplierOrderIsFavorite ? '★' : '☆'}
                        </button>
                      ) : (
                        <span className='supplier-order-row-star supplier-order-row-star-placeholder' />
                      )}
                      <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                        {receipt.number}
                      </button>
                    </div>
                  ) : columnKey === 'product' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenProduct(receipt)}>
                      {receipt.productName}
                    </button>
                  ) : columnKey === 'quantity' ? (
                    t('warehouse.tables.receipts.quantityPcs', {
                      count: receipt.quantity,
                    })
                  ) : columnKey === 'price' ? (
                    formatCurrency(receipt.price)
                  ) : columnKey === 'amount' ? (
                    formatCurrency(receipt.amount)
                  ) : columnKey === 'paid' ? (
                    formatCurrency(receipt.paid)
                  ) : columnKey === 'supplier' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenSupplier(receipt)}>
                      {receipt.supplierName}
                    </button>
                  ) : columnKey === 'receiptDate' ? (
                    formatDate(receipt.createdAt)
                  ) : columnKey === 'acceptedBy' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.acceptedBy}
                    </button>
                  ) : columnKey === 'approvedBy' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.approvedBy}
                    </button>
                  ) : columnKey === 'status' ? (
                    <span
                      className={
                        receipt.status === 'cancelled'
                          ? 'receipt-status receipt-status-cancelled'
                          : receipt.status === 'received'
                            ? 'receipt-status receipt-status-received'
                            : receipt.status === 'new'
                              ? 'receipt-status receipt-status-new'
                              : 'receipt-status receipt-status-approved'
                      }
                    >
                      {t(`warehouse.tables.receipts.status.${receipt.status}`)}
                    </span>
                  ) : receipt.status === 'new' ? (
                    '-'
                  ) : receipt.paymentStatus ? (
                    <span
                      className={getReceiptPaymentStatusClass(
                        receipt.paymentStatus,
                      )}
                    >
                      {t(
                        `warehouse.tables.receipts.paymentStatus.${receipt.paymentStatus}`,
                      )}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};


export const StockTable = ({
  products,
  isLoading,
  visibleColumns,
  selectedProductIds,
  warehouses,
  serviceCenters,
  salesByProductId,
  supplierOrdersByProductId,
  productWarehouseMetaById,
  onToggleProductSelection,
  onTogglePageSelection,
  onEdit,
  onOpenModel,
  onOpenSerial,
  onDelete,
  onOpenSupplierOrder,
}: {
  products: Product[];
  isLoading: boolean;
  visibleColumns: StockColumnKey[];
  selectedProductIds: string[];
  warehouses: WarehouseItem[];
  serviceCenters: ServiceCenter[];
  salesByProductId: Record<string, Sale[]>;
  supplierOrdersByProductId: Record<string, SupplierOrderLink[]>;
  productWarehouseMetaById: Record<string, ProductWarehouseMeta>;
  onToggleProductSelection: (productId: string) => void;
  onTogglePageSelection: () => void;
  onEdit: (product: Product) => void;
  onOpenModel: (product: Product) => void;
  onOpenSerial: (product: Product) => void;
  onDelete: (product: Product) => void;
  onOpenSupplierOrder: (
    supplierOrderId: string,
    itemIndex: number,
  ) => void;
}) => {
  const { t } = useTranslation();
  const isPageSelected =
    products.length > 0 &&
    products.every((product) => selectedProductIds.includes(product.id));
  const isPagePartiallySelected =
    !isPageSelected &&
    products.some((product) => selectedProductIds.includes(product.id));
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isPagePartiallySelected;
    }
  }, [isPagePartiallySelected]);

  const warehouseById = useMemo(
    () =>
      warehouses.reduce<Record<string, WarehouseItem>>((acc, warehouse) => {
        acc[warehouse.id] = warehouse;
        return acc;
      }, {}),
    [warehouses],
  );
  const serviceCenterById = useMemo(
    () =>
      serviceCenters.reduce<Record<string, ServiceCenter>>(
        (acc, serviceCenter) => {
          acc[serviceCenter.id] = serviceCenter;
          return acc;
        },
        {},
      ),
    [serviceCenters],
  );

  if (isLoading)
    return (
      <p className='empty-state warehouse-stock-empty'>
        {t('warehouse.tables.stock.loading')}
      </p>
    );
  if (products.length === 0)
    return (
      <div className='empty-state warehouse-stock-empty'>
        <strong>{t('warehouse.tables.stock.emptyTitle')}</strong>
        <span>{t('warehouse.tables.stock.emptyHint')}</span>
      </div>
    );
  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-stock-table'>
        <thead>
          <tr>
            {visibleColumns.map((columnKey) => (
              <th
                key={columnKey}
                className={`warehouse-stock-cell-${columnKey}`}
              >
                {columnKey === 'select' ? (
                  <input
                    ref={selectAllRef}
                    type='checkbox'
                    aria-label={t(
                      'warehouse.tables.stock.selectAllAriaLabel',
                    )}
                    checked={isPageSelected}
                    onChange={onTogglePageSelection}
                  />
                ) : (
                  t(`warehouse.tables.stock.columns.${columnKey}`)
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              {(() => {
                const linkedSales = salesByProductId[product.id] ?? [];
                const linkedSupplierOrders =
                  supplierOrdersByProductId[product.id] ?? [];
                const supplierLabel = getStockSupplierLabel(
                  product,
                  linkedSupplierOrders,
                );
                const warehouse = warehouseById[
                  productWarehouseMetaById[product.id]?.warehouseId ?? ''
                ];
                const serviceCenterColor = warehouse
                  ? serviceCenterById[warehouse.serviceCenterId]?.color
                  : '';
                const warehouseBadgeStyle =
                  getWarehouseBadgeAccentStyle(serviceCenterColor);
                const getOrderHref = (
                  sale: Sale,
                  tab: 'orders' | 'sales',
                ) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('page', 'orders');
                  url.searchParams.set('ordersTab', tab);
                  url.searchParams.set('saleId', sale.id);
                  url.searchParams.delete('createOrder');
                  return `${url.pathname}${url.search}${url.hash}`;
                };

                return (
                  <>
                    {visibleColumns.map((columnKey) => (
                      <td
                        key={`${product.id}-${columnKey}`}
                        className={[
                          `warehouse-stock-cell-${columnKey}`,
                          columnKey === 'name' ? 'catalog-name-cell' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {columnKey === 'select' ? (
                          <input
                            type='checkbox'
                            aria-label={t(
                              'warehouse.tables.stock.selectRowAriaLabel',
                              { name: product.name },
                            )}
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => onToggleProductSelection(product.id)}
                          />
                        ) : columnKey === 'name' ? (
                          <button
                            type='button'
                            className='settings-link-button'
                            onClick={() => onOpenModel(product)}
                          >
                            {product.name}
                          </button>
                        ) : columnKey === 'serial' ? (
                          <button
                            type='button'
                            className='settings-link-button'
                            onClick={() => onOpenSerial(product)}
                          >
                            {product.serialNumber}
                          </button>
                        ) : columnKey === 'article' ? (
                          <button
                            type='button'
                            className='settings-link-button'
                            onClick={() => onOpenModel(product)}
                          >
                            {product.article}
                          </button>
                        ) : columnKey === 'date' ? (
                          formatDate(product.purchaseDate)
                        ) : columnKey === 'purchase' ? (
                          formatCurrency(product.price)
                        ) : columnKey === 'warehouse' ? (
                          <span
                            className={[
                              'warehouse-data-badge',
                              'warehouse-data-badge-warehouse',
                              serviceCenterColor
                                ? 'warehouse-data-badge-warehouse-colored'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={warehouseBadgeStyle}
                          >
                            {productWarehouseMetaById[product.id]
                              ?.warehouseName ?? '-'}
                          </span>
                        ) : columnKey === 'location' ? (
                          <span className='warehouse-data-badge warehouse-data-badge-location'>
                            {productWarehouseMetaById[product.id]
                              ?.locationName ?? '-'}
                          </span>
                        ) : columnKey === 'clientOrder' ? (
                          linkedSales.length === 0
                            ? '-'
                            : linkedSales.map((sale, index) => (
                                <span key={`${product.id}-sale-${sale.id}`}>
                                  {index > 0 ? ', ' : null}
                                  <a
                                    className='warehouse-link-badge'
                                    href={getOrderHref(
                                      sale,
                                      sale.kind === 'sale'
                                        ? 'sales'
                                        : 'orders',
                                    )}
                                  >
                                    {sale.recordNumber ||
                                      sale.id.slice(0, 8)}
                                  </a>
                                </span>
                              ))
                        ) : columnKey === 'supplierOrder' ? (
                          linkedSupplierOrders.length === 0
                            ? '-'
                            : linkedSupplierOrders.map(
                                (order, index) => (
                                  <span
                                    key={`${product.id}-supplier-${order.order.id}-${order.itemIndex}`}
                                  >
                                    {index > 0 ? ', ' : null}
                                    <button
                                      type='button'
                                      className='warehouse-link-badge'
                                      onClick={() =>
                                        onOpenSupplierOrder(
                                          order.order.id,
                                          order.itemIndex,
                                        )
                                      }
                                    >
                                      {order.displayNumber}
                                    </button>
                                  </span>
                                ),
                              )
                        ) : columnKey === 'supplier' ? (
                          <button
                            type='button'
                            className='settings-link-button'
                            onClick={() => onEdit(product)}
                          >
                            {supplierLabel}
                          </button>
                        ) : columnKey === 'note' ? (
                          <button
                            type='button'
                            className='settings-link-button warehouse-stock-note-button'
                            onClick={() => onOpenModel(product)}
                            title={product.note || ''}
                          >
                            {product.note || '-'}
                          </button>
                        ) : (
                          <div className='catalog-row-actions'>
                            <button
                              type='button'
                              className='danger-button'
                              onClick={() => onDelete(product)}
                            >
                              &times;
                            </button>
                          </div>
                        )}
                      </td>
                    ))}
                  </>
                );
              })()}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};