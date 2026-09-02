import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderStatus,
} from '../../../../entities/supplier-order/model/types';
import { formatCurrency } from '../../../../shared/lib/format';
import {
  CompactPaginationPanel,
  PaginationPanel,
} from '../../../../shared/ui/PaginationPanel';
import { CopyableValue } from '../../../../shared/ui/CopyableValue';
import { TruncatedTextTooltip } from '../../../../shared/ui/TruncatedTextTooltip';
import { OrdersWorkspaceTabList } from '../orders/workspace/OrdersWorkspaceTabList';
import { buildSupplierOrderItemNumber } from '../../model/supplier-order-utils';
import {
  buildSupplierOrderTableRows,
  formatSupplierOrderDate,
  getSupplierOrderStatusClass,
  getSupplierOrderStatusLabel,
  getSupplierPaymentStatusClass,
  getSupplierPaymentStatusLabel,
  isSupplierOrderDeliveryOverdue,
  isSupplierOrderPaidAmountUnpaid,
  manualSupplierOrderStatuses,
  summarizeSupplierOrderItems,
  supplierOrdersAllColumns,
  supplierOrdersLockedColumns,
  type OrdersTab,
  type SupplierOrdersColumnKey,
} from '../../model/supplier-orders-workspace';

export { SupplierInformationDashboard } from './SupplierInformationDashboard';

type SupplierOrdersToolbarProps = {
  activeTab: OrdersTab;
  activeFiltersCount: number;
  filteredOrdersCount: number;
  isColumnsMenuOpen: boolean;
  isFilterBarOpen: boolean;
  isInformationTab: boolean;
  columnsMenuRef: RefObject<HTMLDivElement | null>;
  page: number;
  pageSize: number;
  query: string;
  favoritesOnly: boolean;
  visibleColumns: SupplierOrdersColumnKey[];
  visibleTabs: OrdersTab[];
  permittedTabs?: OrdersTab[];
  canManageSupplierOrders: boolean;
  onActiveTabChange: (tab: OrdersTab) => void;
  onToggleTabVisibility?: (tab: OrdersTab) => void;
  onCreateOrder: () => void;
  onColumnsMenuOpenChange: Dispatch<SetStateAction<boolean>>;
  onFilterBarOpenChange: Dispatch<SetStateAction<boolean>>;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onFavoritesOnlyChange: () => void;
  onToggleColumnVisibility: (columnKey: SupplierOrdersColumnKey) => void;
  onResetColumns: () => void;
  onOpenSingleMatch?: () => void;
};

export const SupplierOrdersToolbar = ({
  activeTab,
  activeFiltersCount,
  filteredOrdersCount,
  isColumnsMenuOpen,
  isFilterBarOpen,
  isInformationTab,
  columnsMenuRef,
  page,
  pageSize,
  query,
  favoritesOnly,
  visibleColumns,
  visibleTabs,
  permittedTabs,
  canManageSupplierOrders,
  onActiveTabChange,
  onToggleTabVisibility,
  onCreateOrder,
  onColumnsMenuOpenChange,
  onFilterBarOpenChange,
  onPageChange,
  onQueryChange,
  onFavoritesOnlyChange,
  onToggleColumnVisibility,
  onResetColumns,
  onOpenSingleMatch,
}: SupplierOrdersToolbarProps) => {
  const { t } = useTranslation();
  const canOpenSingleMatch =
    Boolean(onOpenSingleMatch) &&
    query.trim().length > 0 &&
    filteredOrdersCount === 1;
  const countLabel = t('orders.kanban.ordersCount', {
    count: filteredOrdersCount,
  });
  const countChip = canOpenSingleMatch ? (
    <button
      type='button'
      className='orders-kanban-count'
      aria-label={countLabel}
      onClick={onOpenSingleMatch}
    >
      {countLabel}
    </button>
  ) : (
    <span className='orders-kanban-count' aria-label={countLabel}>
      {countLabel}
    </span>
  );

  return (
  <>
    <OrdersWorkspaceTabList
      activeTab={activeTab}
      visibleTabs={visibleTabs}
      permittedTabs={permittedTabs}
      onActiveTabChange={onActiveTabChange}
      onToggleTabVisibility={onToggleTabVisibility}
    />

    <div className='orders-toolbar'>
      <div className='orders-toolbar-left'>
        {isInformationTab || canOpenSingleMatch ? (
          countChip
        ) : (
          <CompactPaginationPanel
            totalItems={filteredOrdersCount}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
        )}
        <button
          type='button'
          className='toolbar-filter-button toolbar-filter-toggle-button'
          aria-expanded={isFilterBarOpen}
          onClick={() => onFilterBarOpenChange((current) => !current)}
        >
          {t('orders.toolbar.filter')}
          {activeFiltersCount > 0 ? (
            <span className='toolbar-filter-count'>{activeFiltersCount}</span>
          ) : null}
        </button>

        {!isInformationTab ? (
          <div className='toolbar-settings' ref={columnsMenuRef}>
            <button
              type='button'
              className='toolbar-square-button'
              aria-label={t('orders.toolbar.toggleColumns')}
              aria-expanded={isColumnsMenuOpen}
              onClick={() => onColumnsMenuOpenChange((current) => !current)}
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                className='toolbar-square-button-icon'
                fill='currentColor'
              >
                <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
              </svg>
            </button>
            {isColumnsMenuOpen ? (
              <div className='toolbar-settings-menu'>
                {supplierOrdersAllColumns.map((columnKey) => (
                  <label key={columnKey} className='toolbar-settings-option'>
                    <input
                      type='checkbox'
                      checked={visibleColumns.includes(columnKey)}
                      disabled={supplierOrdersLockedColumns.includes(columnKey)}
                      onChange={() => onToggleColumnVisibility(columnKey)}
                    />
                    <span>{t(`orders.supplier.columns.${columnKey}`)}</span>
                  </label>
                ))}
                <button
                  type='button'
                  className='toolbar-settings-reset'
                  onClick={onResetColumns}
                >
                  {t('orders.toolbar.resetColumns')}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isInformationTab ? (
          <button
            type='button'
            className={
              favoritesOnly
                ? 'toolbar-square-button toolbar-star-button toolbar-star-button-active'
                : 'toolbar-square-button toolbar-star-button'
            }
            aria-label={
              favoritesOnly
                ? t('orders.supplier.toolbar.showAllOrders')
                : t('orders.supplier.toolbar.showStarredOrders')
            }
            aria-pressed={favoritesOnly}
            onClick={onFavoritesOnlyChange}
          >
            <span className='supplier-order-star-icon' aria-hidden='true'>
              {favoritesOnly ? '★' : '☆'}
            </span>
          </button>
        ) : null}

        {!isInformationTab ? (
          <div className='orders-search-group orders-search-group-clearable'>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('orders.supplier.toolbar.searchPlaceholder')}
              title={t('orders.supplier.toolbar.searchPlaceholder')}
              aria-label={t('orders.supplier.toolbar.searchPlaceholder')}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                if (!canOpenSingleMatch) return;
                event.preventDefault();
                onOpenSingleMatch?.();
              }}
            />
            {query ? (
              <span
                role='button'
                tabIndex={0}
                className='orders-search-clear'
                aria-label={t('orders.toolbar.clearSearch')}
                onClick={() => onQueryChange('')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onQueryChange('');
                  }
                }}
              >
                x
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className='orders-toolbar-actions'>
        {canManageSupplierOrders && !isInformationTab ? (
          <button
            type='button'
            className='orders-create-button'
            onClick={onCreateOrder}
          >
            {t('orders.supplier.toolbar.createOrder')}
          </button>
        ) : null}
      </div>
    </div>
  </>
  );
};

type SupplierOrdersTableProps = {
  catalogProducts: CatalogProduct[];
  expandedOrderIds: ReadonlySet<string>;
  filteredOrdersCount: number;
  totals: {
    orderCount: number;
    pcs: number;
    total: number;
    paid: number;
    outstanding: number;
  };
  isLoading: boolean;
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  page: number;
  pageSize: number;
  paginatedOrders: SupplierOrder[];
  suppliers: Supplier[];
  tableWrapRef?: RefObject<HTMLDivElement | null>;
  visibleColumns: SupplierOrdersColumnKey[];
  canViewSupplierOrders: boolean;
  canManageSupplierOrders: boolean;
  onError: (message: string) => void;
  onEditOrder: (
    order: SupplierOrder,
    sourceOrder: SupplierOrder,
    itemIndex: number | null,
  ) => void;
  onOpenCatalogProduct: (product: CatalogProduct) => void;
  onOpenSupplier: (supplier: Supplier) => void;
  onToggleFavorite: (order: SupplierOrder) => void;
  onToggleOrderExpanded: (orderId: string) => void;
  onOpenStatusOrder: (
    key: string,
    order: SupplierOrder,
    itemIndex: number | null,
    rect: DOMRect,
  ) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export const SupplierOrdersTable = ({
  catalogProducts,
  expandedOrderIds,
  filteredOrdersCount,
  totals,
  isLoading,
  openStatusOrder,
  page,
  pageSize,
  paginatedOrders,
  suppliers,
  tableWrapRef,
  visibleColumns,
  canViewSupplierOrders,
  canManageSupplierOrders,
  onError,
  onEditOrder,
  onOpenCatalogProduct,
  onOpenSupplier,
  onToggleFavorite,
  onToggleOrderExpanded,
  onOpenStatusOrder,
  onPageChange,
  onPageSizeChange,
}: SupplierOrdersTableProps) => {
  const { t } = useTranslation();
  const notApplicableLabel = t('orders.supplier.table.statusNotApplicable');

  return (
  <>
    <div className='orders-table-wrap' ref={tableWrapRef}>
      <table className='orders-table supplier-orders-table'>
        <thead>
          <tr>
            {visibleColumns.includes('number') ? (
              <th className='supplier-orders-col-number'>{t('orders.supplier.columns.number')}</th>
            ) : null}
            {visibleColumns.includes('product') ? (
              <th className='supplier-orders-col-product'>{t('orders.supplier.columns.product')}</th>
            ) : null}
            {visibleColumns.includes('quantity') ? (
              <th className='supplier-orders-col-quantity'>{t('orders.supplier.columns.quantity')}</th>
            ) : null}
            {visibleColumns.includes('price') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.price')}</th>
            ) : null}
            {visibleColumns.includes('total') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.total')}</th>
            ) : null}
            {visibleColumns.includes('paid') ? (
              <th className='supplier-orders-col-money'>{t('orders.supplier.columns.paid')}</th>
            ) : null}
            {visibleColumns.includes('supplier') ? (
              <th className='supplier-orders-col-supplier'>{t('orders.supplier.columns.supplier')}</th>
            ) : null}
            {visibleColumns.includes('createdAt') ? (
              <th className='supplier-orders-col-date'>{t('orders.supplier.columns.createdAt')}</th>
            ) : null}
            {visibleColumns.includes('createdBy') ? (
              <th className='supplier-orders-col-created-by'>{t('orders.supplier.columns.createdBy')}</th>
            ) : null}
            {visibleColumns.includes('deliveryDate') ? (
              <th className='supplier-orders-col-date'>{t('orders.supplier.columns.deliveryDate')}</th>
            ) : null}
            {visibleColumns.includes('status') ? (
              <th className='supplier-orders-col-status'>{t('orders.supplier.columns.status')}</th>
            ) : null}
            {visibleColumns.includes('paymentStatus') ? (
              <th className='supplier-orders-col-payment'>{t('orders.supplier.columns.paymentStatus')}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {paginatedOrders.flatMap((order) =>
            buildSupplierOrderTableRows(order, expandedOrderIds).map((row) => {
              const isChild = row.kind === 'child';
              const isParent = row.kind === 'parent';
              const item =
                row.kind === 'child' || row.kind === 'single' ? row.item : null;
              const summary = isParent
                ? summarizeSupplierOrderItems(order)
                : null;
              const rowClassName = isParent
                ? 'supplier-order-group-parent'
                : isChild
                  ? 'supplier-order-group-child'
                  : undefined;

              const openProductCatalog = (targetItem: NonNullable<typeof item>) => {
                const matchedProduct = targetItem.catalogProductId
                  ? catalogProducts.find(
                      (product) => product.id === targetItem.catalogProductId,
                    )
                  : catalogProducts.find(
                      (product) =>
                        product.name.trim().toLowerCase() ===
                        targetItem.productName.trim().toLowerCase(),
                    );
                if (!matchedProduct) {
                  onError(t('orders.supplier.messages.errors.productNotFound'));
                  return;
                }
                if (!canManageSupplierOrders) {
                  onError(t('orders.supplier.messages.errors.noManagePermission'));
                  return;
                }
                onOpenCatalogProduct(matchedProduct);
              };

              const openOrderModal = () => {
                if (!canViewSupplierOrders) {
                  onError(t('orders.supplier.messages.errors.noViewPermission'));
                  return;
                }

                if (isParent) {
                  onEditOrder(order, order, null);
                  return;
                }

                if (!item) return;

                onEditOrder(
                  {
                    ...order,
                    receiptStatus: item.receiptStatus ?? 'new',
                    number: buildSupplierOrderItemNumber(order, item.itemIndex),
                    items: [item],
                  },
                  order,
                  item.itemIndex,
                );
              };

              return (
                <tr key={`${order.id}-${row.id}`} className={rowClassName}>
                  {visibleColumns.includes('number') ? (
                    <td
                      className='supplier-orders-number-cell'
                      data-label={t('orders.supplier.columns.number')}
                    >
                      <div className='supplier-order-number-cell'>
                        {isParent ? (
                          <button
                            type='button'
                            className='supplier-order-expand-toggle'
                            aria-expanded={expandedOrderIds.has(order.id)}
                            aria-label={
                              expandedOrderIds.has(order.id)
                                ? t('orders.supplier.table.collapseOrder', {
                                    id: row.id,
                                  })
                                : t('orders.supplier.table.expandOrder', {
                                    id: row.id,
                                  })
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleOrderExpanded(order.id);
                            }}
                          >
                            {expandedOrderIds.has(order.id) ? '⌃' : '⌄'}
                          </button>
                        ) : null}
                        {!isChild ? (
                          <button
                            type='button'
                            className={
                              order.isFavorite === true
                                ? 'supplier-order-row-star supplier-order-row-star-active'
                                : 'supplier-order-row-star'
                            }
                            aria-label={
                              order.isFavorite === true
                                ? t('orders.supplier.table.unstarOrder', {
                                    id: row.id,
                                  })
                                : t('orders.supplier.table.starOrder', {
                                    id: row.id,
                                  })
                            }
                            aria-pressed={order.isFavorite === true}
                            disabled={!canManageSupplierOrders}
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleFavorite(order);
                            }}
                          >
                            {order.isFavorite === true ? '★' : '☆'}
                          </button>
                        ) : (
                          <span
                            className='supplier-order-row-star-placeholder'
                            aria-hidden='true'
                          />
                        )}
                        <CopyableValue
                          value={
                            row.kind === 'child' ? row.label : row.id
                          }
                        >
                          <button
                            type='button'
                            className='supplier-order-number-button'
                            onClick={openOrderModal}
                          >
                            {row.kind === 'child' ? row.label : row.id}
                          </button>
                        </CopyableValue>
                      </div>
                    </td>
                  ) : null}
                  {visibleColumns.includes('product') ? (
                    <td data-label={t('orders.supplier.columns.product')}>
                      {isParent && summary ? (
                        <span className='supplier-order-items-summary'>
                          {t('orders.supplier.table.itemsCount', {
                            count: summary.count,
                          })}
                        </span>
                      ) : item ? (
                        <button
                          type='button'
                          className={`catalog-name-button${
                            item.receiptStatus === 'cancelled'
                              ? ' supplier-order-item-cancelled'
                              : ''
                          }`}
                          onClick={() => openProductCatalog(item)}
                        >
                          <TruncatedTextTooltip text={item.productName}>
                            {item.productName}
                          </TruncatedTextTooltip>
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                  {visibleColumns.includes('quantity') ? (
                    <td data-label={t('orders.supplier.columns.quantity')}>
                      {isParent && summary
                        ? `${summary.totalQuantity} ${t('orders.supplier.table.pcs')}`
                        : item
                          ? `${item.quantity} ${t('orders.supplier.table.pcs')}`
                          : null}
                    </td>
                  ) : null}
                  {visibleColumns.includes('price') ? (
                    <td data-label={t('orders.supplier.columns.price')}>
                      {isParent
                        ? notApplicableLabel
                        : item
                          ? formatCurrency(item.price)
                          : null}
                    </td>
                  ) : null}
                  {visibleColumns.includes('total') ? (
                    <td data-label={t('orders.supplier.columns.total')}>
                      {isParent
                        ? formatCurrency(order.total)
                        : item
                          ? formatCurrency(item.quantity * item.price)
                          : null}
                    </td>
                  ) : null}
                  {visibleColumns.includes('paid') ? (
                    <td
                      data-label={t('orders.supplier.columns.paid')}
                      className={
                        !isChild && isSupplierOrderPaidAmountUnpaid(order)
                          ? 'orders-money-unpaid'
                          : undefined
                      }
                    >
                      {isChild
                        ? notApplicableLabel
                        : formatCurrency(order.paid)}
                    </td>
                  ) : null}
                  {visibleColumns.includes('supplier') ? (
                    <td data-label={t('orders.supplier.columns.supplier')}>
                      {isChild ? (
                        notApplicableLabel
                      ) : (
                        <button
                          type='button'
                          className='catalog-name-button'
                          onClick={() => {
                            const matchedSupplier = suppliers.find(
                              (supplier) => supplier.id === order.supplierId,
                            );
                            if (!matchedSupplier) {
                              onError(
                                t('orders.supplier.messages.errors.supplierNotFound'),
                              );
                              return;
                            }
                            if (!canManageSupplierOrders) {
                              onError(
                                t('orders.supplier.messages.errors.noManagePermission'),
                              );
                              return;
                            }
                            onOpenSupplier(matchedSupplier);
                          }}
                        >
                          {order.supplierName}
                        </button>
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.includes('createdAt') ? (
                    <td data-label={t('orders.supplier.columns.createdAt')}>
                      {isChild
                        ? notApplicableLabel
                        : formatSupplierOrderDate(order.createdAt)}
                    </td>
                  ) : null}
                  {visibleColumns.includes('createdBy') ? (
                    <td data-label={t('orders.supplier.columns.createdBy')}>
                      {isChild ? notApplicableLabel : order.createdBy || notApplicableLabel}
                    </td>
                  ) : null}
                  {visibleColumns.includes('deliveryDate') ? (
                    <td
                      data-label={t('orders.supplier.columns.deliveryDate')}
                      className={
                        !isChild && isSupplierOrderDeliveryOverdue(order)
                          ? 'supplier-order-delivery-overdue'
                          : undefined
                      }
                    >
                      {isChild
                        ? notApplicableLabel
                        : formatSupplierOrderDate(order.deliveryDate)}
                    </td>
                  ) : null}
                  {visibleColumns.includes('status') ? (
                    <td data-label={t('orders.supplier.columns.status')}>
                      {isChild ? (
                        <span className='supplier-order-group-child-muted'>
                          {notApplicableLabel}
                        </span>
                      ) : (
                        <div className='supplier-order-status-picker'>
                          <button
                            type='button'
                            className={getSupplierOrderStatusClass(order.status)}
                            data-supplier-order-status-trigger={row.id}
                            disabled={
                              !canManageSupplierOrders ||
                              order.paymentStatus === 'cancelled' ||
                              order.status === 'cancelled' ||
                              order.status === 'unavailable'
                            }
                            aria-expanded={openStatusOrder?.key === row.id}
                            aria-haspopup='listbox'
                            onClick={(event) =>
                              onOpenStatusOrder(
                                row.id,
                                order,
                                isParent ? null : (item?.itemIndex ?? null),
                                event.currentTarget.getBoundingClientRect(),
                              )
                            }
                          >
                            {getSupplierOrderStatusLabel(order.status)}
                          </button>
                        </div>
                      )}
                    </td>
                  ) : null}
                  {visibleColumns.includes('paymentStatus') ? (
                    <td data-label={t('orders.supplier.columns.paymentStatus')}>
                      {isChild ? (
                        <span className='supplier-order-group-child-muted'>
                          {notApplicableLabel}
                        </span>
                      ) : (
                        <span
                          className={getSupplierPaymentStatusClass(
                            order.paymentStatus,
                          )}
                        >
                          {getSupplierPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
      {isLoading ? <p className='orders-empty'>{t('orders.supplier.table.loading')}</p> : null}
      {!isLoading && paginatedOrders.length === 0 ? (
        <p className='orders-empty'>{t('orders.supplier.table.empty')}</p>
      ) : null}
      {!isLoading && paginatedOrders.length > 0 ? (
        <div className='supplier-orders-totals' role='status'>
          <span>
            {t('orders.supplier.table.totalsOrders', { count: totals.orderCount })}
          </span>
          <span>
            {t('orders.supplier.table.totalsPcs', { count: totals.pcs })}
          </span>
          <span>
            {t('orders.supplier.table.totalsAmount', {
              amount: formatCurrency(totals.total),
            })}
          </span>
          <span>
            {t('orders.supplier.table.totalsPaid', {
              amount: formatCurrency(totals.paid),
            })}
          </span>
          <span>
            {t('orders.supplier.table.totalsOutstanding', {
              amount: formatCurrency(totals.outstanding),
            })}
          </span>
        </div>
      ) : null}
    </div>

    <PaginationPanel
      totalItems={filteredOrdersCount}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    />
  </>
  );
};

export const SupplierOrderStatusMenuPortal = ({
  openStatusOrder,
  statusMenuPosition,
  onUpdateStatus,
}: {
  openStatusOrder: { key: string; order: SupplierOrder } | null;
  statusMenuPosition: {
    top: number;
    left: number;
    maxHeight: number;
    placement: 'below' | 'above';
  } | null;
  onUpdateStatus: (order: SupplierOrder, status: SupplierOrderStatus) => void;
}) => {
  const { t } = useTranslation();
  const optionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const options = optionsRef.current;
    if (!options) return;

    const handleWheel = (event: WheelEvent) => {
      event.stopPropagation();
      const { scrollTop, scrollHeight, clientHeight } = options;
      if (scrollHeight <= clientHeight) {
        event.preventDefault();
        return;
      }

      const deltaY = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((deltaY > 0 && atBottom) || (deltaY < 0 && atTop)) {
        event.preventDefault();
      }
    };

    options.addEventListener('wheel', handleWheel, { passive: false });
    return () => options.removeEventListener('wheel', handleWheel);
  }, [openStatusOrder, statusMenuPosition]);

  if (!openStatusOrder || !statusMenuPosition || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={`supplier-order-status-menu supplier-order-status-menu-portal supplier-order-status-menu-portal-${statusMenuPosition.placement}`}
      style={{
        top: statusMenuPosition.top,
        left: statusMenuPosition.left,
        maxHeight: statusMenuPosition.maxHeight,
      }}
    >
      <div className='supplier-order-status-menu-header'>
        {t('orders.supplier.statusMenu.orderLabel', { id: openStatusOrder.key })}
      </div>
      <div
        ref={optionsRef}
        className='supplier-order-status-menu-options'
        role='listbox'
        aria-label={t('orders.supplier.statusMenu.orderLabel', {
          id: openStatusOrder.key,
        })}
      >
        {manualSupplierOrderStatuses.map((status) => (
          <button
            key={status.key}
            type='button'
            role='option'
            aria-selected={status.key === openStatusOrder.order.status}
            className={
              status.key === openStatusOrder.order.status
                ? 'supplier-order-status-option supplier-order-status-option-active'
                : 'supplier-order-status-option'
            }
            onClick={() => onUpdateStatus(openStatusOrder.order, status.key)}
          >
            {t(status.labelKey)}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
};

export const SupplierEditModal = ({
  form,
  isSaving,
  onClose,
  onFormChange,
  onSave,
}: {
  form: { name: string; phone: string; note: string; isActive: boolean };
  isSaving: boolean;
  onClose: () => void;
  onFormChange: Dispatch<
    SetStateAction<{ name: string; phone: string; note: string; isActive: boolean }>
  >;
  onSave: () => void;
}) => {
  const { t } = useTranslation();

  return (
  <div
    className='modal-backdrop'
    role='presentation'
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
      <header className='catalog-edit-header'>
        <div className='catalog-edit-title'>
          <h2>{t('orders.supplier.editModal.supplier')}</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>{t('common.name')}</span>
          <input
            value={form.name}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className='field'>
          <span>{t('orders.supplier.editModal.phone')}</span>
          <input
            value={form.phone}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                phone: event.target.value,
              }))
            }
          />
        </label>
        <label className='field field-wide'>
          <span>{t('orders.supplier.editModal.note')}</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={
            isSaving || form.name.trim().length < 2 || form.phone.trim().length < 3
          }
          onClick={onSave}
        >
          {isSaving ? t('orders.supplier.editModal.saving') : t('common.save')}
        </button>
      </footer>
    </section>
  </div>
  );
};

export const CatalogProductEditModal = ({
  form,
  isSaving,
  onClose,
  onFormChange,
  onSave,
}: {
  form: { name: string; note: string; isActive: boolean };
  isSaving: boolean;
  onClose: () => void;
  onFormChange: Dispatch<SetStateAction<{ name: string; note: string; isActive: boolean }>>;
  onSave: () => void;
}) => {
  const { t } = useTranslation();

  return (
  <div
    className='modal-backdrop'
    role='presentation'
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section className='catalog-edit-modal' role='dialog' aria-modal='true'>
      <header className='catalog-edit-header'>
        <div className='catalog-edit-title'>
          <h2>{t('orders.supplier.editModal.product')}</h2>
        </div>
        <button
          type='button'
          className='create-order-close'
          onClick={onClose}
          aria-label={t('common.close')}
        >
          &times;
        </button>
      </header>
      <div className='catalog-edit-body'>
        <label className='field'>
          <span>{t('orders.supplier.editModal.productName')}</span>
          <input
            value={form.name}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className='field field-wide'>
          <span>{t('orders.supplier.editModal.note')}</span>
          <textarea
            rows={3}
            value={form.note}
            onChange={(event) =>
              onFormChange((current) => ({
                ...current,
                note: event.target.value,
              }))
            }
          />
        </label>
      </div>
      <footer className='catalog-edit-footer'>
        <button
          type='button'
          className='primary-button'
          disabled={isSaving || form.name.trim().length < 2}
          onClick={onSave}
        >
          {isSaving ? t('orders.supplier.editModal.saving') : t('common.save')}
        </button>
      </footer>
    </section>
  </div>
  );
};
