import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  repairStatuses,
  saleStatuses,
  type OrdersFilters,
} from './orders-workspace-shared';
import { buildOrdersFilterChips } from './orders-filter-chips';

type OrdersActiveFilterChipsProps = {
  filters: OrdersFilters;
  assigneeLabelById: Map<string, string>;
  onChangeFilters: (next: OrdersFilters) => void;
  onClearAll: () => void;
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
