import type { SalesListParams } from '../../../../../entities/sale/api/saleApi';
import { kanbanVisibleRepairStatuses } from './orders-workspace-shared';
import type { OrdersFilters, OrdersTab } from './orders-workspace-shared';

export const SALES_KANBAN_PAGE_SIZE = 500;

export const buildOrdersSalesListParams = ({
  tab,
  filters,
  searchValue,
  page,
  pageSize,
}: {
  tab: OrdersTab;
  filters: OrdersFilters;
  searchValue: string;
  page: number;
  pageSize: number;
}): SalesListParams => {
  const isKanban = tab === 'kanban';
  const isRepair = tab === 'orders' || isKanban;

  return {
    kind: isRepair ? 'repair' : 'sale',
    compact: true,
    page: isKanban ? 1 : page,
    pageSize: isKanban ? SALES_KANBAN_PAGE_SIZE : pageSize,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    isFavorite: filters.favoritesOnly ? true : undefined,
    statuses: isKanban
      ? [...kanbanVisibleRepairStatuses]
      : filters.statuses.length > 0
        ? filters.statuses
        : undefined,
    masterId: isKanban && filters.assigneeId ? filters.assigneeId : undefined,
    assigneeId: !isKanban && filters.assigneeId ? filters.assigneeId : undefined,
    repairType: filters.repairType !== 'all' ? filters.repairType : undefined,
    paymentMethod: filters.paymentMethod || undefined,
    q: searchValue.trim() || undefined,
    recordNumber: filters.orderNumber.trim() || undefined,
    client: filters.client.trim() || undefined,
    product: filters.product.trim() || undefined,
    service: filters.service.trim() || undefined,
  };
};
