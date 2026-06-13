import { useEffect, useMemo, useRef } from 'react';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { formatCurrency, formatDate } from '../../../shared/lib/format';
import { getStockSupplierLabel } from '../model/stock-balance';
import {
  getReceiptPaymentStatusClass,
  getReceiptPaymentStatusLabel,
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
}: {
  receipts: ReceiptRow[];
  visibleColumns: ReceiptsColumnKey[];
  onOpenOrder: (receipt: ReceiptRow) => void;
  onOpenProduct: (receipt: ReceiptRow) => void;
  onOpenSupplier: (receipt: ReceiptRow) => void;
}) => {
  if (receipts.length === 0)
    return <p className='empty-state'>No receipt orders created.</p>;
  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-receipts-table'>
        <thead>
          <tr>
            {visibleColumns.map((columnKey) => (
              <th key={columnKey}>
                {columnKey === 'number'
                  ? '#'
                  : columnKey === 'product'
                    ? 'Product'
                    : columnKey === 'quantity'
                      ? 'Quantity'
                      : columnKey === 'price'
                        ? 'Price'
                        : columnKey === 'amount'
                          ? 'Amount'
                          : columnKey === 'paid'
                            ? 'Paid'
                            : columnKey === 'supplier'
                              ? 'Supplier'
                              : columnKey === 'receiptDate'
                                ? 'Receipt Date'
                                : columnKey === 'acceptedBy'
                                  ? 'Accepted By'
                                  : columnKey === 'approvedBy'
                                    ? 'Approved By'
                                    : columnKey === 'status'
                                      ? 'Status'
                                      : 'Payment'}
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
                    <button type='button' className='catalog-name-button' onClick={() => onOpenOrder(receipt)}>
                      {receipt.number}
                    </button>
                  ) : columnKey === 'product' ? (
                    <button type='button' className='catalog-name-button' onClick={() => onOpenProduct(receipt)}>
                      {receipt.productName}
                    </button>
                  ) : columnKey === 'quantity' ? (
                    `${receipt.quantity} pcs`
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
                      {receipt.status === 'cancelled'
                        ? 'Cancelled'
                        : receipt.status === 'received'
                          ? 'Taken on charge'
                          : receipt.status === 'new'
                            ? 'New'
                            : 'Approved'}
                    </span>
                  ) : receipt.status === 'new' ? (
                    '-'
                  ) : receipt.paymentStatus ? (
                    <span
                      className={getReceiptPaymentStatusClass(
                        receipt.paymentStatus,
                      )}
                    >
                      {getReceiptPaymentStatusLabel(
                        receipt.paymentStatus,
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
        Loading warehouse stock...
      </p>
    );
  if (products.length === 0)
    return (
      <div className='empty-state warehouse-stock-empty'>
        <strong>No stock rows found.</strong>
        <span>Adjust search or filters to see available stock.</span>
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
                    aria-label='Select all stock rows'
                    checked={isPageSelected}
                    onChange={onTogglePageSelection}
                  />
                ) : columnKey === 'name' ? (
                  'Name'
                ) : columnKey === 'serial' ? (
                  'Serial #'
                ) : columnKey === 'article' ? (
                  'Article'
                ) : columnKey === 'date' ? (
                  'Date'
                ) : columnKey === 'purchase' ? (
                  'Purchase'
                ) : columnKey === 'warehouse' ? (
                  'Warehouse'
                ) : columnKey === 'location' ? (
                  'Location'
                ) : columnKey === 'clientOrder' ? (
                  'Client order'
                ) : columnKey === 'supplierOrder' ? (
                  'Supplier order'
                ) : columnKey === 'supplier' ? (
                  'Supplier'
                ) : columnKey === 'note' ? (
                  'Note'
                ) : (
                  'Action'
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
                            aria-label={`Select ${product.name}`}
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
