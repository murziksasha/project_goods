import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildSupplierOrdersFilterChips,
  getSupplierOrderStatusLabel,
  getSupplierPaymentStatusLabel,
  type SupplierOrdersFilters,
} from '../../model/supplier-orders-workspace';

type SupplierOrdersActiveFilterChipsProps = {
  filters: SupplierOrdersFilters;
  supplierLabelById: Map<string, string>;
  onChangeFilters: (next: SupplierOrdersFilters) => void;
  onClearAll: () => void;
};

export const SupplierOrdersActiveFilterChips = ({
  filters,
  supplierLabelById,
  onChangeFilters,
  onClearAll,
}: SupplierOrdersActiveFilterChipsProps) => {
  const { t } = useTranslation();

  const chips = useMemo(
    () =>
      buildSupplierOrdersFilterChips(filters, {
        status: getSupplierOrderStatusLabel,
        payment: getSupplierPaymentStatusLabel,
        supplier: (id) =>
          `${t('orders.supplier.filters.supplier')}: ${
            supplierLabelById.get(id) || id
          }`,
        createdBy: t('orders.supplier.filters.createdBy'),
        product: t('orders.supplier.filters.product'),
        orderNumber: t('orders.supplier.filters.orderNumber'),
        dateFrom: t('orders.supplier.filters.dateFrom'),
        dateTo: t('orders.supplier.filters.dateTo'),
        dateFieldCreated: t('orders.supplier.filters.dateFieldCreated'),
        query: t('orders.supplier.toolbar.search'),
        favorites: t('orders.filters.favoritesOnly'),
      }),
    [filters, supplierLabelById, t],
  );

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className='orders-active-filter-chips' role='list'>
      {chips.map((chip) => (
        <button
          key={chip.id}
          type='button'
          className='orders-filter-chip'
          role='listitem'
          onClick={() => onChangeFilters(chip.clear(filters))}
          title={t('orders.filters.clearChip', { label: chip.label })}
        >
          <span className='orders-filter-chip-label'>{chip.label}</span>
          <span className='orders-filter-chip-remove' aria-hidden='true'>
            ×
          </span>
        </button>
      ))}
      <button
        type='button'
        className='orders-filter-chips-clear-all'
        onClick={onClearAll}
      >
        {t('orders.filters.clearAll')}
      </button>
    </div>
  );
};
