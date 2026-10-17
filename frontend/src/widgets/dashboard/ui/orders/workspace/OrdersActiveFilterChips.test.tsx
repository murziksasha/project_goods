import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrdersActiveFilterChips } from './OrdersActiveFilterChips';
import { buildOrdersFilterChips } from './orders-filter-chips';
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
        saleType: 'Sale type',
        saleTypeRapid: 'Rapid sale',
        saleTypeRegular: 'Regular',
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

  it('builds a chip for rapid sale type', () => {
    const chips = buildOrdersFilterChips(
      { ...emptyOrdersFilters, saleType: 'rapid' },
      {
        status: (status) => status,
        assignee: (id) => id,
        orderNumber: 'Order number',
        client: 'Client',
        assigneeField: 'Assignee',
        warehouse: 'Warehouse',
        repairType: 'Repair type',
        repairPaid: 'Paid',
        repairWarranty: 'Warranty',
        saleType: 'Sale type',
        saleTypeRapid: 'Rapid sale',
        saleTypeRegular: 'Regular',
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

    expect(chips.map((chip) => chip.id)).toEqual(['saleType']);
    expect(chips[0]?.label).toBe('Sale type: Rapid sale');
    expect(chips[0]?.clear({ ...emptyOrdersFilters, saleType: 'rapid' }).saleType).toBe(
      'all',
    );
  });

  it('builds one chip per row for master filter, removes only that row on clear, and last x returns to All', () => {
    const filters: OrdersFilters = {
      ...emptyOrdersFilters,
      includeUnassignedMaster: true,
      masterIds: ['m1', 'm2'],
    };

    const labels = {
      status: (status: OrderStatus) => status,
      assignee: (id: string) => (id === 'm1' ? 'Kostiantyn' : id === 'm2' ? 'Petro' : id),
      orderNumber: 'Order number',
      client: 'Client',
      assigneeField: 'Master',
      masterField: 'Master',
      withoutMaster: 'Without master',
      warehouse: 'Warehouse',
      repairType: 'Repair type',
      repairPaid: 'Paid',
      repairWarranty: 'Warranty',
      saleType: 'Sale type',
      saleTypeRapid: 'Rapid sale',
      saleTypeRegular: 'Regular',
      payment: 'Payment',
      paymentCash: 'Cash',
      paymentNonCash: 'Non-cash',
      dateFrom: 'From',
      dateTo: 'To',
      product: 'Product',
      service: 'Service',
      favorites: 'Favorites only',
    };

    const chips = buildOrdersFilterChips(filters, labels);

    expect(chips.map((chip) => chip.id)).toEqual([
      'master-unassigned',
      'master-m1',
      'master-m2',
    ]);
    expect(chips.map((chip) => chip.label)).toEqual([
      'Master: Without master',
      'Master: Kostiantyn',
      'Master: Petro',
    ]);

    // x on Without master removes only that row
    const afterUnassignedClear = chips[0].clear(filters);
    expect(afterUnassignedClear.includeUnassignedMaster).toBe(false);
    expect(afterUnassignedClear.masterIds).toEqual(['m1', 'm2']);

    // x on m1 removes only m1
    const afterM1Clear = chips[1].clear(filters);
    expect(afterM1Clear.includeUnassignedMaster).toBe(true);
    expect(afterM1Clear.masterIds).toEqual(['m2']);

    // x on the last remaining master chip returns to All (masterIds: [], includeUnassignedMaster: false)
    const singleMasterFilter: OrdersFilters = {
      ...emptyOrdersFilters,
      masterIds: ['m2'],
      includeUnassignedMaster: false,
    };
    const singleChips = buildOrdersFilterChips(singleMasterFilter, labels);
    expect(singleChips).toHaveLength(1);
    const afterLastClear = singleChips[0].clear(singleMasterFilter);
    expect(afterLastClear.masterIds).toEqual([]);
    expect(afterLastClear.includeUnassignedMaster).toBe(false);
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
