import { describe, expect, it } from 'vitest';
import {
  canHideOrdersTab,
  resolveDisplayedOrdersTabs,
  resolvePermittedOrdersTabs,
} from './orders-tab-visibility';
import type { OrdersTab } from './types';

const permitted: OrdersTab[] = [
  'orders',
  'kanban',
  'sales',
  'supplierOrders',
  'supplierInformation',
];

describe('resolveDisplayedOrdersTabs', () => {
  it('shows every permitted tab when nothing is hidden', () => {
    expect(resolveDisplayedOrdersTabs(permitted, [])).toEqual(permitted);
  });

  it('hides selected permitted tabs', () => {
    expect(resolveDisplayedOrdersTabs(permitted, ['kanban', 'sales'])).toEqual([
      'orders',
      'supplierOrders',
      'supplierInformation',
    ]);
  });

  it('ignores hidden keys the user cannot access', () => {
    expect(
      resolveDisplayedOrdersTabs(['orders', 'sales'], ['supplierOrders', 'sales']),
    ).toEqual(['orders']);
  });

  it('falls back to the first permitted tab when all would be hidden', () => {
    expect(
      resolveDisplayedOrdersTabs(['orders', 'sales'], ['orders', 'sales']),
    ).toEqual(['orders']);
  });
});

describe('resolvePermittedOrdersTabs', () => {
  it('keeps kanban for existing order-view access without kanban.use', () => {
    expect(
      resolvePermittedOrdersTabs({
        canViewRepairSalesOrders: true,
        canViewSupplierOrders: false,
        canViewKanban: true,
      }),
    ).toEqual(['orders', 'kanban', 'sales']);
  });

  it('shows only kanban when the employee has kanban.use and no order rights', () => {
    expect(
      resolvePermittedOrdersTabs({
        canViewRepairSalesOrders: false,
        canViewSupplierOrders: false,
        canViewKanban: true,
      }),
    ).toEqual(['kanban']);
  });

  it('does not expose orders or sales from kanban.use alone', () => {
    expect(
      resolvePermittedOrdersTabs({
        canViewRepairSalesOrders: false,
        canViewSupplierOrders: true,
        canViewKanban: true,
      }),
    ).toEqual(['kanban', 'supplierOrders', 'supplierInformation']);
  });
});

describe('canHideOrdersTab', () => {
  it('blocks hiding the last remaining visible tab', () => {
    expect(canHideOrdersTab(['orders', 'sales'], ['sales'], 'orders')).toBe(
      false,
    );
  });

  it('allows hiding a tab when another remains', () => {
    expect(canHideOrdersTab(permitted, ['sales'], 'orders')).toBe(true);
  });
});
