import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Product } from '../../../../entities/product/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import { getOrderLink } from '../../../../pages/dashboard/model/dashboard-navigation';
import { formatCurrency, formatDate } from '../../../../shared/lib/format';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import { SelectableActionLink } from '../../../../shared/ui/SelectableActionLink';
import { TableSkeleton } from '../../../../shared/ui/TableSkeleton';
import { TruncatedTextTooltip } from '../../../../shared/ui/TruncatedTextTooltip';
import {
  getStockSupplierLabel,
  type StockModelGroup,
} from '../../model/stock-balance';
import {
  clampWarehouseStockNameWidth,
  getReceiptGroupStatus,
  getReceiptGroupTotals,
  getReceiptPaymentStatusClass,
  getReceiptStatusClassName,
  getWarehouseBadgeAccentStyle,
  getWarehouseStockTableMinWidth,
  readWarehouseStockNameWidth,
  writeWarehouseStockNameWidth,
  type ProductWarehouseMeta,
  type ReceiptRow,
  type ReceiptsColumnKey,
  type ReceiptsViewMode,
  type ReceiptStatus,
  type ServiceCenter,
  type StockColumnKey,
  type StockViewMode,
  type SupplierOrderLink,
  type WarehouseItem,
} from '../../model/warehouse-panel';

const emptyMark = '\u2014';

const EmptyValue = () => (
  <span className='warehouse-empty-value'>{emptyMark}</span>
);

const TruncatedCell = ({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) => {
  const value = text.trim();
  if (!value || value === '-') return <EmptyValue />;
  return (
    <TruncatedTextTooltip text={value} className='warehouse-cell-truncate'>
      {children}
    </TruncatedTextTooltip>
  );
};

const ReceiptStatusBadge = ({ status }: { status: ReceiptStatus }) => {
  const { t } = useTranslation();
  return (
    <span className={getReceiptStatusClassName(status)}>
      {t(`warehouse.tables.receipts.status.${status}`)}
    </span>
  );
};

const ReceiptPaymentCell = ({ receipt }: { receipt: ReceiptRow }) => {
  const { t } = useTranslation();
  if (receipt.status === 'new' || !receipt.paymentStatus) return <EmptyValue />;
  const label = t(
    `warehouse.tables.receipts.paymentStatus.${receipt.paymentStatus}`,
  );
  return (
    <TruncatedTextTooltip
      text={label}
      className={`warehouse-cell-truncate ${getReceiptPaymentStatusClass(
        receipt.paymentStatus,
      )}${
        receipt.paymentStatus === 'pending'
          ? ' receipt-payment-status-pill'
          : ''
      }`}
    />
  );
};

const isReceiptNumColumn = (columnKey: ReceiptsColumnKey | 'expand') =>
  columnKey === 'quantity' ||
  columnKey === 'price' ||
  columnKey === 'amount' ||
  columnKey === 'paid';

const ReceiptStarButton = ({
  receipt,
  canManageSupplierOrders,
  onToggleFavorite,
}: {
  receipt: ReceiptRow;
  canManageSupplierOrders: boolean;
  onToggleFavorite: (receipt: ReceiptRow) => void;
}) => {
  const { t } = useTranslation();
  if (!receipt.supplierOrderId) {
    return (
      <span className='supplier-order-row-star supplier-order-row-star-placeholder' />
    );
  }
  return (
    <button
      type='button'
      className={
        receipt.supplierOrderIsFavorite
          ? 'supplier-order-row-star supplier-order-row-star-active'
          : 'supplier-order-row-star'
      }
      aria-label={
        receipt.supplierOrderIsFavorite
          ? t('warehouse.tables.receipts.removeStarAriaLabel', {
              number: receipt.number,
            })
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
      {receipt.supplierOrderIsFavorite ? '\u2605' : '\u2606'}
    </button>
  );
};

export const ReceiptsTable = ({
  receipts,
  groups,
  view,
  visibleColumns,
  onOpenOrder,
  onOpenProduct,
  onOpenSupplier,
  onToggleFavorite,
  canManageSupplierOrders,
}: {
  receipts: ReceiptRow[];
  groups?: Array<{ id: string; number: string; receipts: ReceiptRow[] }>;
  view: ReceiptsViewMode;
  visibleColumns: ReceiptsColumnKey[];
  onOpenOrder: (receipt: ReceiptRow) => void;
  onOpenProduct: (receipt: ReceiptRow) => void;
  onOpenSupplier: (receipt: ReceiptRow) => void;
  onToggleFavorite: (receipt: ReceiptRow) => void;
  canManageSupplierOrders: boolean;
}) => {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (receipts.length === 0)
    return (
      <p className='empty-state'>{t('warehouse.tables.receipts.empty')}</p>
    );

  const renderLineCell = (
    receipt: ReceiptRow,
    columnKey: ReceiptsColumnKey,
  ) => {
    if (columnKey === 'number') {
      return (
        <div className='supplier-order-number-cell'>
          <ReceiptStarButton
            receipt={receipt}
            canManageSupplierOrders={canManageSupplierOrders}
            onToggleFavorite={onToggleFavorite}
          />
          <CopyableValue value={receipt.number}>
            <button
              type='button'
              className='catalog-name-button warehouse-cell-truncate'
              onClick={() => onOpenOrder(receipt)}
            >
              <TruncatedCell text={receipt.number}>
                {receipt.number}
              </TruncatedCell>
            </button>
          </CopyableValue>
        </div>
      );
    }
    if (columnKey === 'product') {
      return (
        <button
          type='button'
          className={`catalog-name-button warehouse-cell-truncate${
            receipt.status === 'cancelled'
              ? ' supplier-order-item-cancelled'
              : ''
          }`}
          onClick={() => onOpenProduct(receipt)}
        >
          <TruncatedCell text={receipt.productName}>
            {receipt.productName}
          </TruncatedCell>
        </button>
      );
    }
    if (columnKey === 'quantity') {
      return t('warehouse.tables.receipts.quantityPcs', {
        count: receipt.quantity,
      });
    }
    if (columnKey === 'price') return formatCurrency(receipt.price);
    if (columnKey === 'amount') return formatCurrency(receipt.amount);
    if (columnKey === 'paid') return formatCurrency(receipt.paid);
    if (columnKey === 'supplier') {
      return (
        <button
          type='button'
          className='catalog-name-button warehouse-cell-truncate'
          onClick={() => onOpenSupplier(receipt)}
        >
          <TruncatedCell text={receipt.supplierName}>
            {receipt.supplierName}
          </TruncatedCell>
        </button>
      );
    }
    if (columnKey === 'receiptDate') return formatDate(receipt.createdAt);
    if (columnKey === 'acceptedBy') {
      return (
        <button
          type='button'
          className='catalog-name-button'
          onClick={() => onOpenOrder(receipt)}
        >
          <TruncatedCell text={receipt.acceptedBy} />
        </button>
      );
    }
    if (columnKey === 'approvedBy') {
      return (
        <button
          type='button'
          className='catalog-name-button'
          onClick={() => onOpenOrder(receipt)}
        >
          <TruncatedCell text={receipt.approvedBy} />
        </button>
      );
    }
    if (columnKey === 'status') {
      return <ReceiptStatusBadge status={receipt.status} />;
    }
    return <ReceiptPaymentCell receipt={receipt} />;
  };

  if (view === 'lines' || !groups) {
    return (
      <div className='catalog-table-wrap'>
        <table className='catalog-table warehouse-receipts-table table-card-stack'>
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
                  <td
                    key={`${receipt.id}-${columnKey}`}
                    data-label={t(
                      `warehouse.tables.receipts.columns.${columnKey}`,
                    )}
                    className={
                      isReceiptNumColumn(columnKey)
                        ? 'warehouse-num-cell'
                        : undefined
                    }
                  >
                    {renderLineCell(receipt, columnKey)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const ordersColumns: Array<ReceiptsColumnKey | 'expand'> = [
    'expand',
    ...visibleColumns,
  ];

  const renderOrdersCell = (
    column: ReceiptsColumnKey | 'expand',
    groupReceipts: ReceiptRow[],
    isChild: boolean,
    receipt: ReceiptRow,
    groupId: string,
    expanded: boolean,
  ) => {
    const first = groupReceipts[0];
    const totals = getReceiptGroupTotals(groupReceipts);
    const extraProducts = groupReceipts.length - 1;
    const uniquePrices = Array.from(
      new Set(groupReceipts.map((item) => item.price)),
    );

    if (column === 'expand') {
      if (isChild || groupReceipts.length < 2) return null;
      return (
        <button
          type='button'
          className='warehouse-expand-button'
          aria-expanded={expanded}
          aria-label={
            expanded
              ? t('warehouse.tables.receipts.collapseOrder', {
                  number: first.number,
                })
              : t('warehouse.tables.receipts.expandOrder', {
                  number: first.number,
                })
          }
          onClick={() => toggleExpanded(groupId)}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </button>
      );
    }
    if (column === 'number') {
      if (isChild) return null;
      return (
        <div className='supplier-order-number-cell'>
          <ReceiptStarButton
            receipt={first}
            canManageSupplierOrders={canManageSupplierOrders}
            onToggleFavorite={onToggleFavorite}
          />
          <CopyableValue value={first.number}>
            <button
              type='button'
              className='catalog-name-button warehouse-cell-truncate'
              onClick={() => onOpenOrder(first)}
            >
              <TruncatedCell text={first.number}>{first.number}</TruncatedCell>
            </button>
          </CopyableValue>
        </div>
      );
    }
    if (column === 'product') {
      const target = isChild ? receipt : first;
      return (
        <button
          type='button'
          className={`catalog-name-button warehouse-cell-truncate${
            target.status === 'cancelled' ? ' supplier-order-item-cancelled' : ''
          }`}
          onClick={() => onOpenProduct(target)}
        >
          <TruncatedCell text={target.productName}>
            {target.productName}
          </TruncatedCell>
          {!isChild && extraProducts > 0 ? (
            <span className='warehouse-more-count'>
              {t('warehouse.tables.receipts.moreProducts', {
                count: extraProducts,
              })}
            </span>
          ) : null}
        </button>
      );
    }
    if (column === 'quantity') {
      return t('warehouse.tables.receipts.quantityPcs', {
        count: isChild ? receipt.quantity : totals.quantity,
      });
    }
    if (column === 'price') {
      if (isChild) return formatCurrency(receipt.price);
      if (uniquePrices.length !== 1) return <EmptyValue />;
      return formatCurrency(uniquePrices[0]);
    }
    if (column === 'amount') {
      return formatCurrency(isChild ? receipt.amount : totals.amount);
    }
    if (column === 'paid') {
      if (isChild) return null;
      return formatCurrency(totals.paid);
    }
    if (column === 'supplier') {
      if (isChild) return null;
      return (
        <button
          type='button'
          className='catalog-name-button warehouse-cell-truncate'
          onClick={() => onOpenSupplier(first)}
        >
          <TruncatedCell text={first.supplierName}>
            {first.supplierName}
          </TruncatedCell>
        </button>
      );
    }
    if (column === 'receiptDate') {
      if (isChild) return null;
      return formatDate(first.createdAt);
    }
    if (column === 'acceptedBy' || column === 'approvedBy') {
      if (isChild) return null;
      const value =
        column === 'acceptedBy' ? first.acceptedBy : first.approvedBy;
      return (
        <button
          type='button'
          className='catalog-name-button'
          onClick={() => onOpenOrder(first)}
        >
          <TruncatedCell text={value} />
        </button>
      );
    }
    if (column === 'status') {
      return (
        <ReceiptStatusBadge
          status={isChild ? receipt.status : getReceiptGroupStatus(groupReceipts)}
        />
      );
    }
    if (isChild) return null;
    return <ReceiptPaymentCell receipt={first} />;
  };

  return (
    <div className='catalog-table-wrap'>
      <table className='catalog-table warehouse-receipts-table warehouse-receipts-table-orders table-card-stack'>
        <thead>
          <tr>
            {ordersColumns.map((columnKey) => (
              <th
                key={columnKey}
                className={
                  columnKey === 'expand' ? 'warehouse-expand-cell' : undefined
                }
              >
                {columnKey === 'expand'
                  ? null
                  : t(`warehouse.tables.receipts.columns.${columnKey}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const expanded =
              group.receipts.length > 1 && expandedIds.has(group.id);
            const parentRow = (
              <tr
                key={group.id}
                className={
                  group.receipts.length > 1
                    ? 'warehouse-group-row'
                    : undefined
                }
              >
                {ordersColumns.map((columnKey) => (
                  <td
                    key={`${group.id}-${columnKey}`}
                    data-label={
                      columnKey === 'expand'
                        ? ''
                        : t(`warehouse.tables.receipts.columns.${columnKey}`)
                    }
                    className={
                      columnKey === 'expand'
                        ? 'warehouse-expand-cell'
                        : isReceiptNumColumn(columnKey)
                          ? 'warehouse-num-cell'
                          : undefined
                    }
                  >
                    {renderOrdersCell(
                      columnKey,
                      group.receipts,
                      false,
                      group.receipts[0],
                      group.id,
                      expanded,
                    )}
                  </td>
                ))}
              </tr>
            );
            if (!expanded) return parentRow;
            return (
              <Fragment key={group.id}>
                {parentRow}
                {group.receipts.map((receipt) => (
                  <tr
                    key={`${group.id}-${receipt.id}`}
                    className='warehouse-child-row'
                  >
                    {ordersColumns.map((columnKey) => (
                      <td
                        key={`${receipt.id}-${columnKey}`}
                        data-label={
                          columnKey === 'expand'
                            ? ''
                            : t(`warehouse.tables.receipts.columns.${columnKey}`)
                        }
                        className={
                          columnKey === 'expand'
                            ? 'warehouse-expand-cell'
                            : isReceiptNumColumn(columnKey)
                              ? 'warehouse-num-cell'
                              : columnKey === 'product'
                                ? 'warehouse-child-name'
                                : undefined
                        }
                      >
                        {renderOrdersCell(
                          columnKey,
                          group.receipts,
                          true,
                          receipt,
                          group.id,
                          expanded,
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const StockRowActions = ({
  product,
  onDelete,
  onTransfer,
}: {
  product: Product;
  onDelete: (product: Product) => void;
  onTransfer?: (product: Product) => void;
}) => {
  const { t } = useTranslation();
  return (
    <details className='warehouse-row-menu'>
      <summary
        className='warehouse-row-menu-toggle'
        aria-label={t('warehouse.actions.more')}
      >
        <span aria-hidden='true'>{'\u22EE'}</span>
      </summary>
      <div className='warehouse-row-menu-panel'>
        {onTransfer ? (
          <button
            type='button'
            onClick={() => onTransfer(product)}
          >
            {t('warehouse.actions.transfer')}
          </button>
        ) : null}
        <button
          type='button'
          className='warehouse-row-menu-danger'
          onClick={() => onDelete(product)}
        >
          {t('warehouse.actions.delete')}
        </button>
      </div>
    </details>
  );
};

export const StockTable = ({
  products,
  groups,
  view,
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
  onToggleGroupSelection,
  onEdit,
  onOpenModel,
  onOpenSerial,
  onDelete,
  onTransfer,
  onOpenSupplierOrder,
  onOpenSaleCard,
}: {
  products: Product[];
  groups?: StockModelGroup[];
  view: StockViewMode;
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
  onToggleGroupSelection: (productIds: string[]) => void;
  onEdit: (product: Product) => void;
  onOpenModel: (product: Product) => void;
  onOpenSerial: (product: Product) => void;
  onDelete: (product: Product) => void;
  onTransfer?: (product: Product) => void;
  onOpenSupplierOrder: (
    supplierOrderId: string,
    itemIndex: number,
  ) => void;
  onOpenSaleCard?: (sale: Sale) => void;
}) => {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [nameColumnWidth, setNameColumnWidth] = useState(
    readWarehouseStockNameWidth,
  );
  const [isNameColumnResizing, setIsNameColumnResizing] = useState(false);

  useEffect(() => {
    writeWarehouseStockNameWidth(nameColumnWidth);
  }, [nameColumnWidth]);

  const startNameColumnResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = nameColumnWidth;
    handle.setPointerCapture(event.pointerId);
    setIsNameColumnResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      setNameColumnWidth(
        clampWarehouseStockNameWidth(startWidth + moveEvent.clientX - startX),
      );
    };
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      setIsNameColumnResizing(false);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  };

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

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading)
    return (
      <TableSkeleton
        className='warehouse-stock-empty'
        rows={6}
        columns={Math.max(visibleColumns.length, 4)}
        label={t('warehouse.tables.stock.loading')}
      />
    );
  if (products.length === 0)
    return (
      <div className='empty-state warehouse-stock-empty'>
        <strong>{t('warehouse.tables.stock.emptyTitle')}</strong>
        <span>{t('warehouse.tables.stock.emptyHint')}</span>
      </div>
    );

  const renderStockCell = (
    product: Product,
    columnKey: StockColumnKey,
    options?: {
      isGroup?: boolean;
      groupProducts?: Product[];
      groupId?: string;
      expanded?: boolean;
      isChild?: boolean;
    },
  ) => {
    const linkedSales = salesByProductId[product.id] ?? [];
    const linkedSupplierOrders = supplierOrdersByProductId[product.id] ?? [];
    const supplierLabel = getStockSupplierLabel(product, linkedSupplierOrders);
    const warehouse = warehouseById[
      productWarehouseMetaById[product.id]?.warehouseId ?? ''
    ];
    const serviceCenterColor = warehouse
      ? serviceCenterById[warehouse.serviceCenterId]?.color
      : '';
    const warehouseBadgeStyle =
      getWarehouseBadgeAccentStyle(serviceCenterColor);
    const meta = productWarehouseMetaById[product.id];
    const locationName = meta?.locationName ?? '';
    const warehouseName = meta?.warehouseName ?? '';
    const groupProducts = options?.groupProducts ?? [product];
    const isGroup = options?.isGroup === true && groupProducts.length > 1;
    const isSelected = isGroup
      ? groupProducts.every((item) => selectedProductIds.includes(item.id))
      : selectedProductIds.includes(product.id);

    if (columnKey === 'select') {
      return (
        <input
          type='checkbox'
          aria-label={
            isGroup
              ? t('warehouse.tables.stock.selectModelAriaLabel', {
                  name: product.name,
                })
              : t('warehouse.tables.stock.selectRowAriaLabel', {
                  name: product.name,
                })
          }
          checked={isSelected}
          onChange={() =>
            isGroup
              ? onToggleGroupSelection(groupProducts.map((item) => item.id))
              : onToggleProductSelection(product.id)
          }
        />
      );
    }
    if (columnKey === 'name') {
      return (
        <span className='warehouse-name-with-qty'>
          {isGroup ? (
            <button
              type='button'
              className='warehouse-expand-button'
              aria-expanded={options?.expanded === true}
              aria-label={
                options?.expanded
                  ? t('warehouse.tables.stock.collapseModel', {
                      name: product.name,
                    })
                  : t('warehouse.tables.stock.expandModel', {
                      name: product.name,
                    })
              }
              onClick={() => options?.groupId && toggleExpanded(options.groupId)}
            >
              {options?.expanded ? '\u25BE' : '\u25B8'}
            </button>
          ) : null}
          <CopyableValue value={product.name}>
            <SelectableActionLink
              className='settings-link-button warehouse-cell-truncate'
              onAction={() => onOpenModel(product)}
            >
              <TruncatedCell text={product.name}>{product.name}</TruncatedCell>
            </SelectableActionLink>
          </CopyableValue>
          {isGroup ? (
            <span className='warehouse-data-badge warehouse-data-badge-location'>
              {t('warehouse.tables.receipts.quantityPcs', {
                count: groupProducts.length,
              })}
            </span>
          ) : null}
        </span>
      );
    }
    if (columnKey === 'serial') {
      if (isGroup) return <EmptyValue />;
      return (
        <CopyableValue value={product.serialNumber}>
          <SelectableActionLink
            className='settings-link-button warehouse-cell-truncate'
            onAction={() => onOpenSerial(product)}
          >
            <TruncatedCell text={product.serialNumber}>
              {product.serialNumber}
            </TruncatedCell>
          </SelectableActionLink>
        </CopyableValue>
      );
    }
    if (columnKey === 'article') {
      return (
        <SelectableActionLink
          className='settings-link-button warehouse-cell-truncate'
          onAction={() => onOpenModel(product)}
        >
          <TruncatedCell text={product.article}>{product.article}</TruncatedCell>
        </SelectableActionLink>
      );
    }
    if (columnKey === 'date') {
      if (isGroup) {
        const latest = groupProducts.reduce((current, item) =>
          (item.purchaseDate ?? '') > (current.purchaseDate ?? '')
            ? item
            : current,
        );
        return formatDate(latest.purchaseDate);
      }
      return formatDate(product.purchaseDate);
    }
    if (columnKey === 'purchase') {
      if (isGroup) {
        const total = groupProducts.reduce((sum, item) => sum + item.price, 0);
        return (
          <span className='warehouse-purchase-stack'>
            <span>{formatCurrency(product.price)}</span>
            <span className='warehouse-purchase-total'>
              {formatCurrency(total)}
            </span>
          </span>
        );
      }
      return formatCurrency(product.price);
    }
    if (columnKey === 'warehouse') {
      return (
        <span
          className={[
            'warehouse-data-badge',
            'warehouse-data-badge-warehouse',
            serviceCenterColor ? 'warehouse-data-badge-warehouse-colored' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={warehouseBadgeStyle}
        >
          {warehouseName || emptyMark}
        </span>
      );
    }
    if (columnKey === 'location') {
      return (
        <span className='warehouse-data-badge warehouse-data-badge-location'>
          {locationName || emptyMark}
        </span>
      );
    }
    if (columnKey === 'clientOrder') {
      if (linkedSales.length === 0) return <EmptyValue />;
      return linkedSales.map((sale, index) => {
        const label = sale.recordNumber || sale.id.slice(0, 8);
        return (
          <Fragment key={`${product.id}-sale-${sale.id}`}>
            {index > 0 ? ', ' : null}
            <CopyableValue value={label}>
              <a
                className='warehouse-link-badge'
                href={getOrderLink(sale.id, sale.kind)}
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
                  onOpenSaleCard?.(sale);
                }}
              >
                {label}
              </a>
            </CopyableValue>
          </Fragment>
        );
      });
    }
    if (columnKey === 'supplierOrder') {
      if (linkedSupplierOrders.length === 0) return <EmptyValue />;
      return linkedSupplierOrders.map((order, index) => (
        <Fragment
          key={`${product.id}-supplier-${order.order.id}-${order.itemIndex}`}
        >
          {index > 0 ? ', ' : null}
          <CopyableValue value={order.displayNumber}>
            <button
              type='button'
              className='warehouse-link-badge'
              onClick={() =>
                onOpenSupplierOrder(order.order.id, order.itemIndex)
              }
            >
              {order.displayNumber}
            </button>
          </CopyableValue>
        </Fragment>
      ));
    }
    if (columnKey === 'supplier') {
      return (
        <button
          type='button'
          className='settings-link-button warehouse-cell-truncate'
          onClick={() => onEdit(product)}
        >
          <TruncatedCell text={supplierLabel}>{supplierLabel}</TruncatedCell>
        </button>
      );
    }
    if (columnKey === 'note') {
      if (isGroup) return <EmptyValue />;
      return (
        <button
          type='button'
          className='settings-link-button warehouse-stock-note-button'
          onClick={() => onOpenModel(product)}
          title={product.note || ''}
        >
          {product.note ? (
            <TruncatedCell text={product.note}>{product.note}</TruncatedCell>
          ) : (
            <EmptyValue />
          )}
        </button>
      );
    }
    if (isGroup) return null;
    return (
      <StockRowActions
        product={product}
        onDelete={onDelete}
        onTransfer={onTransfer}
      />
    );
  };

  const renderProductRow = (
    product: Product,
    extraClass?: string,
    options?: {
      isGroup?: boolean;
      groupProducts?: Product[];
      groupId?: string;
      expanded?: boolean;
      isChild?: boolean;
    },
  ) => {
    const isSelected = selectedProductIds.includes(product.id);
    return (
      <tr
        key={
          options?.isGroup && options.groupId
            ? `group-${options.groupId}`
            : product.id
        }
        className={[
          extraClass,
          isSelected && !options?.isGroup ? 'warehouse-row-selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {visibleColumns.map((columnKey) => (
          <td
            key={`${options?.groupId ?? product.id}-${columnKey}`}
            className={[
              `warehouse-stock-cell-${columnKey}`,
              columnKey === 'name' ? 'catalog-name-cell' : '',
              columnKey === 'purchase' ? 'warehouse-num-cell' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-label={
              columnKey === 'select'
                ? ''
                : t(`warehouse.tables.stock.columns.${columnKey}`)
            }
          >
            {renderStockCell(product, columnKey, options)}
          </td>
        ))}
      </tr>
    );
  };

  const body =
    view === 'models' && groups
      ? groups.map((group) => {
          const canExpand = group.products.length > 1;
          const expanded = canExpand && expandedIds.has(group.id);
          const parent = renderProductRow(
            group.products[0],
            canExpand ? 'warehouse-group-row' : undefined,
            {
              isGroup: canExpand,
              groupProducts: group.products,
              groupId: group.id,
              expanded,
            },
          );
          if (!expanded) return parent;
          return (
            <Fragment key={group.id}>
              {parent}
              {group.products.map((product) =>
                renderProductRow(product, 'warehouse-child-row', {
                  isChild: true,
                  groupId: `${group.id}-${product.id}`,
                }),
              )}
            </Fragment>
          );
        })
      : products.map((product) => renderProductRow(product));

  return (
    <div className='catalog-table-wrap'>
      <table
        className={[
          'catalog-table',
          'warehouse-stock-table',
          'table-card-stack',
          isNameColumnResizing ? 'warehouse-stock-table-resizing' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          {
            '--warehouse-name-col-width': `${nameColumnWidth}px`,
            minWidth: `max(100%, ${getWarehouseStockTableMinWidth(
              visibleColumns,
              nameColumnWidth,
            )}px)`,
          } as CSSProperties
        }
      >
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
                {columnKey === 'name' ? (
                  <span
                    className={
                      isNameColumnResizing
                        ? 'warehouse-col-resize warehouse-col-resize-active'
                        : 'warehouse-col-resize'
                    }
                    role='separator'
                    aria-orientation='vertical'
                    aria-label={t('warehouse.tables.stock.resizeNameColumn')}
                    onPointerDown={startNameColumnResize}
                  />
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
};
