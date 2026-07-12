import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  emptyOrdersFilters,
  repairStatuses,
  saleStatuses,
  type OrderStatus,
  type OrdersFilters,
  type PaymentMethod,
  type RepairTypeFilter,
} from './orders-workspace-shared';

export type OrdersFilterChip = {
  id: string;
  label: string;
  clear: (current: OrdersFilters) => OrdersFilters;
};

type OrdersActiveFilterChipsProps = {
  filters: OrdersFilters;
  assigneeLabelById: Map<string, string>;
  onChangeFilters: (next: OrdersFilters) => void;
  onClearAll: () => void;
};

const clearField =
  <K extends keyof OrdersFilters>(key: K, value: OrdersFilters[K]) =>
  (current: OrdersFilters): OrdersFilters => ({
    ...current,
    [key]: value,
  });

export const buildOrdersFilterChips = (
  filters: OrdersFilters,
  labels: {
    status: (status: OrderStatus) => string;
    assignee: (id: string) => string;
    orderNumber: string;
    client: string;
    assigneeField: string;
    warehouse: string;
    repairType: string;
    repairPaid: string;
    repairWarranty: string;
    payment: string;
    paymentCash: string;
    paymentNonCash: string;
    dateFrom: string;
    dateTo: string;
    product: string;
    service: string;
    favorites: string;
  },
): OrdersFilterChip[] => {
  const chips: OrdersFilterChip[] = [];

  for (const status of filters.statuses) {
    chips.push({
      id: `status-${status}`,
      label: `${labels.status(status)}`,
      clear: (current) => ({
        ...current,
        statuses: current.statuses.filter((item) => item !== status),
      }),
    });
  }

  if (filters.orderNumber.trim()) {
    chips.push({
      id: 'orderNumber',
      label: `${labels.orderNumber}: ${filters.orderNumber.trim()}`,
      clear: clearField('orderNumber', ''),
    });
  }

  if (filters.client.trim()) {
    chips.push({
      id: 'client',
      label: `${labels.client}: ${filters.client.trim()}`,
      clear: clearField('client', ''),
    });
  }

  if (filters.assigneeId) {
    chips.push({
      id: 'assigneeId',
      label: `${labels.assigneeField}: ${labels.assignee(filters.assigneeId)}`,
      clear: clearField('assigneeId', ''),
    });
  }

  if (filters.warehouse) {
    chips.push({
      id: 'warehouse',
      label: `${labels.warehouse}: ${filters.warehouse}`,
      clear: clearField('warehouse', ''),
    });
  }

  if (filters.repairType !== 'all') {
    chips.push({
      id: 'repairType',
      label: `${labels.repairType}: ${
        filters.repairType === 'warranty'
          ? labels.repairWarranty
          : labels.repairPaid
      }`,
      clear: clearField('repairType', 'all' as RepairTypeFilter),
    });
  }

  if (filters.paymentMethod) {
    chips.push({
      id: 'paymentMethod',
      label: `${labels.payment}: ${
        filters.paymentMethod === 'cash'
          ? labels.paymentCash
          : labels.paymentNonCash
      }`,
      clear: clearField('paymentMethod', '' as '' | PaymentMethod),
    });
  }

  if (filters.dateFrom) {
    chips.push({
      id: 'dateFrom',
      label: `${labels.dateFrom}: ${filters.dateFrom}`,
      clear: clearField('dateFrom', ''),
    });
  }

  if (filters.dateTo) {
    chips.push({
      id: 'dateTo',
      label: `${labels.dateTo}: ${filters.dateTo}`,
      clear: clearField('dateTo', ''),
    });
  }

  if (filters.product.trim()) {
    chips.push({
      id: 'product',
      label: `${labels.product}: ${filters.product.trim()}`,
      clear: clearField('product', ''),
    });
  }

  if (filters.service.trim()) {
    chips.push({
      id: 'service',
      label: `${labels.service}: ${filters.service.trim()}`,
      clear: clearField('service', ''),
    });
  }

  if (filters.favoritesOnly) {
    chips.push({
      id: 'favoritesOnly',
      label: labels.favorites,
      clear: clearField('favoritesOnly', false),
    });
  }

  return chips;
};

export const OrdersActiveFilterChips = ({
  filters,
  assigneeLabelById,
  onChangeFilters,
  onClearAll,
}: OrdersActiveFilterChipsProps) => {
  const { t } = useTranslation();

  const chips = useMemo(
    () =>
      buildOrdersFilterChips(filters, {
        status: (status) => {
          const option =
            repairStatuses.find((item) => item.key === status) ??
            saleStatuses.find((item) => item.key === status);
          return option ? t(option.labelKey) : status;
        },
        assignee: (id) => assigneeLabelById.get(id) || id,
        orderNumber: t('orders.filters.orderNumber'),
        client: t('orders.filters.client'),
        assigneeField: t('orders.filters.assignee'),
        warehouse: t('orders.filters.warehouse'),
        repairType: t('orders.filters.repairType'),
        repairPaid: t('orders.filters.repairTypePaid'),
        repairWarranty: t('orders.filters.repairTypeWarranty'),
        payment: t('orders.filters.paymentMethod'),
        paymentCash: t('orders.filters.paymentCash'),
        paymentNonCash: t('orders.filters.paymentNonCash'),
        dateFrom: t('orders.filters.dateFrom'),
        dateTo: t('orders.filters.dateTo'),
        product: t('orders.filters.product'),
        service: t('orders.filters.service'),
        favorites: t('orders.filters.favoritesOnly'),
      }),
    [assigneeLabelById, filters, t],
  );

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="orders-active-filter-chips" role="list">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="orders-filter-chip"
          role="listitem"
          onClick={() => onChangeFilters(chip.clear(filters))}
          title={t('orders.filters.clearChip', { label: chip.label })}
        >
          <span className="orders-filter-chip-label">{chip.label}</span>
          <span className="orders-filter-chip-remove" aria-hidden="true">
            ×
          </span>
        </button>
      ))}
      <button
        type="button"
        className="orders-filter-chips-clear-all"
        onClick={onClearAll}
      >
        {t('orders.filters.clearAll')}
      </button>
    </div>
  );
};

export const hasAppliedOrdersFilters = (filters: OrdersFilters) =>
  JSON.stringify(filters) !== JSON.stringify(emptyOrdersFilters);
