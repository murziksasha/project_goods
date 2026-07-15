import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  OrdersActiveFilterChips,
  buildOrdersFilterChips,
} from './OrdersActiveFilterChips';
import {
  emptyOrdersFilters,
  type OrderStatus,
  type OrdersFilters,
} from './orders-workspace-shared';

describe('buildOrdersFilterChips', () => {
  it('builds chips for active filters and clears fields', () => {
    const filters: OrdersFilters = {
      ...emptyOrdersFilters,
      client: 'Ivan',
      favoritesOnly: true,
      statuses: ['new'] as OrderStatus[],
    };
    const chips = buildOrdersFilterChips(
      filters,
      {
        status: (status) => status.toUpperCase(),
        assignee: (id) => id,
        orderNumber: 'Order number',
        client: 'Client',
        assigneeField: 'Assignee',
        warehouse: 'Warehouse',
        repairType: 'Repair type',
        repairPaid: 'Paid',
        repairWarranty: 'Warranty',
        payment: 'Payment',
        paymentCash: 'Cash',
        paymentNonCash: 'Non-cash',
        dateFrom: 'From',
        dateTo: 'To',
        product: 'Product',
        service: 'Service',
        favorites: 'Favorites only',
      },
    );

    expect(chips.map((chip) => chip.id)).toEqual([
      'status-new',
      'client',
      'favoritesOnly',
    ]);

    const cleared = chips.reduce(
      (current, chip) => chip.clear(current),
      filters,
    );

    expect(cleared.client).toBe('');
    expect(cleared.favoritesOnly).toBe(false);
    expect(cleared.statuses).toEqual([]);
  });
});

describe('OrdersActiveFilterChips', () => {
  it('renders chips and clears all', () => {
    const onChangeFilters = vi.fn();
    const onClearAll = vi.fn();

    render(
      <OrdersActiveFilterChips
        filters={{
          ...emptyOrdersFilters,
          client: 'Anna',
        }}
        assigneeLabelById={new Map()}
        onChangeFilters={onChangeFilters}
        onClearAll={onClearAll}
      />,
    );

    expect(screen.getByText(/Anna/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
