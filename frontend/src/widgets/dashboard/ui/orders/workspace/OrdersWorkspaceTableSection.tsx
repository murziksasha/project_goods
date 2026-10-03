import type React from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../../entities/sale';
import { PaginationPanel } from '../../../../../shared/ui/PaginationPanel';
import { TableSkeleton } from '../../../../../shared/ui/TableSkeleton';
import {
  ORDER_EXTRA_LINES_MENU_WIDTH,
  formatSaleListDropdownPrice,
  getColumnLabel,
  getOrdersColumnClassName,
  getSaleListDropdownItems,
  getStatusOptionsForSale,
  isRepairStatusChangeLockedByStock,
  isUrgentRepairOrder,
  type OrderStatus,
  type OrderStatusMenuPosition,
  type OrdersColumnKey,
  type OrdersTab,
} from './orders-workspace-shared';

export interface OrdersWorkspaceTableSectionProps {
  activeTab: OrdersTab;
  isLoading: boolean;
  filteredOrders: Sale[];
  paginatedOrders: Sale[];
  visibleColumnKeys: OrdersColumnKey[];
  tableMinWidth: number;
  currentPage: number;
  currentPageSize: number;
  ordersTableWrapRef: RefObject<HTMLDivElement | null>;
  openStatusSale: Sale | null;
  statusMenuPosition: OrderStatusMenuPosition | null;
  statusMenuOptionsRef: RefObject<HTMLDivElement | null>;
  openExtraLinesSale: Sale | null;
  extraLinesMenuPosition: OrderStatusMenuPosition | null;
  extraLinesMenuRef: RefObject<HTMLDivElement | null>;
  getStatus: (sale: Sale) => OrderStatus;
  renderOrdersCell: (sale: Sale, columnKey: OrdersColumnKey) => ReactNode;
  totalItems: number;
  selectedSaleId: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onUpdateStatus: (sale: Sale, status: OrderStatus) => void | Promise<void>;
  onOpenSale: (sale: Sale) => void;
  canAssignStatus: (sale: Sale, status: OrderStatus) => boolean;
};

export const OrdersWorkspaceTableSection: React.FC<OrdersWorkspaceTableSectionProps> = ({
  activeTab,
  isLoading,
  filteredOrders,
  paginatedOrders,
  visibleColumnKeys,
  tableMinWidth,
  currentPage,
  currentPageSize,
  ordersTableWrapRef,
  openStatusSale,
  statusMenuPosition,
  statusMenuOptionsRef,
  openExtraLinesSale,
  extraLinesMenuPosition,
  extraLinesMenuRef,
  getStatus,
  renderOrdersCell,
  totalItems,
  selectedSaleId,
  onPageChange,
  onPageSizeChange,
  onUpdateStatus,
  onOpenSale,
  canAssignStatus,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="orders-table-wrap" ref={ordersTableWrapRef}>
        <table
          className="orders-table orders-workspace-table"
          style={{ minWidth: tableMinWidth }}
        >
          <thead>
            <tr>
              {visibleColumnKeys.map((columnKey) => (
                <th
                  key={columnKey}
                  className={getOrdersColumnClassName(columnKey)}
                >
                  {getColumnLabel(columnKey, activeTab)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={visibleColumnKeys.length} className="orders-empty">
                  <TableSkeleton
                    rows={6}
                    columns={Math.max(visibleColumnKeys.length, 3)}
                    label={t('orders.toolbar.loading')}
                  />
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnKeys.length} className="orders-empty">
                  {activeTab === 'orders'
                    ? t('orders.toolbar.empty.orders')
                    : t('orders.toolbar.empty.sales')}
                </td>
              </tr>
            ) : (
              paginatedOrders.map((sale) => (
                <tr
                  key={sale.id}
                  className={[
                    'orders-table-row',
                    activeTab === 'orders' && isUrgentRepairOrder(sale)
                      ? 'orders-table-row-urgent'
                      : '',
                    selectedSaleId === sale.id ? 'orders-table-row-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (
                      target?.closest(
                        'a, button, input, select, textarea, .order-status-menu, .orders-client-link',
                      )
                    ) {
                      return;
                    }
                    onOpenSale(sale);
                  }}
                >
                  {visibleColumnKeys.map((columnKey) => (
                    <td
                      key={`${sale.id}-${columnKey}`}
                      className={getOrdersColumnClassName(columnKey)}
                      data-label={getColumnLabel(columnKey, activeTab)}
                    >
                      {renderOrdersCell(sale, columnKey)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationPanel
        totalItems={totalItems}
        page={currentPage}
        pageSize={currentPageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />

      {openStatusSale &&
      statusMenuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={statusMenuOptionsRef}
              className={`order-status-options order-status-options-portal order-status-options-portal-${statusMenuPosition.placement}`}
              style={{
                top: statusMenuPosition.top,
                left: statusMenuPosition.left,
                maxHeight: statusMenuPosition.maxHeight,
              }}
            >
              {getStatusOptionsForSale(openStatusSale).map((statusOption) => {
                const stockLocked = isRepairStatusChangeLockedByStock(
                  openStatusSale,
                  statusOption.key,
                );
                const assignDenied = !canAssignStatus(
                  openStatusSale,
                  statusOption.key,
                );
                return (
                <button
                  key={statusOption.key}
                  type="button"
                  disabled={stockLocked || assignDenied}
                  className={
                    statusOption.key === getStatus(openStatusSale)
                      ? 'order-status-option order-status-option-active'
                      : 'order-status-option'
                  }
                  title={
                    stockLocked
                      ? t('orders.payment.stockLocked')
                      : assignDenied
                        ? t('orders.messages.errors.statusChangeDenied')
                        : undefined
                  }
                  onClick={() => {
                    void onUpdateStatus(openStatusSale, statusOption.key);
                  }}
                >
                  {t(statusOption.labelKey)}
                </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      {openExtraLinesSale &&
      extraLinesMenuPosition &&
      typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={extraLinesMenuRef}
              role="listbox"
              aria-label={t('orders.toolbar.extraLinesShow')}
              className={`create-suggestions order-extra-lines-menu order-extra-lines-menu-portal order-extra-lines-menu-portal-${extraLinesMenuPosition.placement}`}
              style={{
                top:
                  extraLinesMenuPosition.bottom == null
                    ? extraLinesMenuPosition.top
                    : 'auto',
                bottom: extraLinesMenuPosition.bottom,
                left: extraLinesMenuPosition.left,
                maxHeight: extraLinesMenuPosition.maxHeight,
                width: ORDER_EXTRA_LINES_MENU_WIDTH,
              }}
            >
              {getSaleListDropdownItems(openExtraLinesSale).map((item) => (
                <div
                  key={item.id}
                  role="option"
                  className="create-suggestion-item order-extra-lines-item"
                >
                  <strong title={item.name}>{item.name}</strong>
                  <span className="order-extra-lines-serial">{item.serial}</span>
                  <span className="order-extra-lines-price">
                    {formatSaleListDropdownPrice(item)}
                  </span>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};