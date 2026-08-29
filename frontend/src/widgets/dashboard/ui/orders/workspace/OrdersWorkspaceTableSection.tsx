import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../../../entities/sale/model/types';
import { PaginationPanel } from '../../../../../shared/ui/PaginationPanel';
import { TableSkeleton } from '../../../../../shared/ui/TableSkeleton';
import {
  getColumnLabel,
  getOrdersColumnClassName,
  getStatusOptionsForSale,
  isRepairStatusChangeLockedByStock,
  isUrgentRepairOrder,
  type OrderStatus,
  type OrderStatusMenuPosition,
  type OrdersColumnKey,
  type OrdersTab,
} from './orders-workspace-shared';

type OrdersWorkspaceTableSectionProps = {
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
  getStatus: (sale: Sale) => OrderStatus;
  renderOrdersCell: (sale: Sale, columnKey: OrdersColumnKey) => ReactNode;
  totalItems: number;
  selectedSaleId: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onUpdateStatus: (sale: Sale, status: OrderStatus) => void | Promise<void>;
  onOpenSale: (sale: Sale) => void;
};

export const OrdersWorkspaceTableSection = ({
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
  getStatus,
  renderOrdersCell,
  totalItems,
  selectedSaleId,
  onPageChange,
  onPageSizeChange,
  onUpdateStatus,
  onOpenSale,
}: OrdersWorkspaceTableSectionProps) => {
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
              {getStatusOptionsForSale(openStatusSale).map((statusOption) => (
                <button
                  key={statusOption.key}
                  type="button"
                  disabled={isRepairStatusChangeLockedByStock(
                    openStatusSale,
                    statusOption.key,
                  )}
                  className={
                    statusOption.key === getStatus(openStatusSale)
                      ? 'order-status-option order-status-option-active'
                      : 'order-status-option'
                  }
                  title={
                    isRepairStatusChangeLockedByStock(
                      openStatusSale,
                      statusOption.key,
                    )
                      ? t('orders.payment.stockLocked')
                      : undefined
                  }
                  onClick={() => {
                    void onUpdateStatus(openStatusSale, statusOption.key);
                  }}
                >
                  {t(statusOption.labelKey)}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};