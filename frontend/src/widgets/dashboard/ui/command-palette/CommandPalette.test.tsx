import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CommandPalette,
  filterCommandPaletteItems,
  buildCommandPaletteItems,
} from './CommandPalette';
import type { Sale } from '../../../../entities/sale/model/types';

const sale = (patch: Partial<Sale> = {}): Sale =>
  ({
    id: 'sale-1',
    kind: 'repair',
    status: 'new',
    recordNumber: 'r000123',
    saleDate: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    client: { id: 'c1', name: 'Ivan', phone: '', phones: [] },
    lineItems: [],
    ...patch,
  }) as Sale;

describe('filterCommandPaletteItems', () => {
  it('hides orders until query is typed', () => {
    const items = buildCommandPaletteItems({
      canAccessPage: () => true,
      canCreateOrders: true,
      canViewOrders: true,
      sales: [sale()],
      labels: {
        page: {
          home: 'Main',
          orders: 'Orders',
          accounting: 'Accounting',
          warehouse: 'Warehouse',
          catalog: 'Catalog',
          clients: 'Clients',
          employees: 'Employees',
          settings: 'Settings',
        },
        createRepair: 'New repair',
        createSale: 'New sale',
        openOrder: 'Open order',
        openSale: 'Open sale',
      },
    });

    const emptyQuery = filterCommandPaletteItems(items, '');
    expect(emptyQuery.some((item) => item.group === 'orders')).toBe(false);
    expect(emptyQuery.some((item) => item.id === 'create-repair')).toBe(true);

    const filtered = filterCommandPaletteItems(items, 'r000123');
    expect(filtered.some((item) => item.action.type === 'openSale')).toBe(true);
  });
});

describe('CommandPalette', () => {
  it('runs selected action on Enter', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen
        canAccessPage={() => true}
        canCreateOrders
        canViewOrders={false}
        sales={[]}
        onClose={onClose}
        onAction={onAction}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'repair' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onAction).toHaveBeenCalledWith({ type: 'createRepair' });
    expect(onClose).toHaveBeenCalled();
  });
});
