import { describe, expect, it } from 'vitest';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  areAllSupplierOrderItemsCancelled,
  buildSupplierOrderTableRows,
  computeSupplierOrderStatusMenuPosition,
  filterSupplierOrders,
  getActiveSupplierOrderItems,
  isSupplierOrderHiddenFromList,
  matchesSupplierOrderStatusFilter,
  normalizeSupplierOrdersColumns,
  parseSupplierOrdersFilters,
  summarizeSupplierOrderItems,
  supplierOrdersAllColumns,
} from './supplier-orders-workspace';

const makeOrder = (patch: Partial<SupplierOrder> = {}): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'sup-1',
  supplierName: 'Parts Hub',
  deliveryDate: '2026-05-19T10:00:00.000Z',
  supplyType: 'local',
  number: 'SO-1',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 500,
  paid: 100,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Type C cable',
      quantity: 5,
      price: 100,
    },
  ],
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
  ...patch,
});

describe('supplier-orders-workspace', () => {
  it('parses persisted filters with legacy deliveryDate fallback', () => {
    expect(
      parseSupplierOrdersFilters(
        JSON.stringify({
          query: 'hub',
          selectedStatuses: ['approved'],
          paymentStatus: 'paid',
          deliveryDate: '2026-05-19',
          favoritesOnly: true,
        }),
      ),
    ).toEqual({
      query: 'hub',
      selectedStatuses: ['approved'],
      paymentStatus: 'paid',
      deliveryDateFrom: '2026-05-19',
      deliveryDateTo: '2026-05-19',
      favoritesOnly: true,
    });
  });

  it('falls back to default filters for invalid persisted JSON', () => {
    expect(parseSupplierOrdersFilters('{')).toEqual({
      query: '',
      selectedStatuses: [],
      paymentStatus: 'all',
      deliveryDateFrom: '',
      deliveryDateTo: '',
      favoritesOnly: false,
    });
  });

  it('normalizes persisted columns to known keys only', () => {
    expect(
      normalizeSupplierOrdersColumns(
        JSON.stringify(['supplier', 'unknown', 'number']),
      ),
    ).toEqual(['number', 'supplier']);
    expect(normalizeSupplierOrdersColumns('[]')).toEqual(
      supplierOrdersAllColumns,
    );
  });

  it('keeps createdAt before deliveryDate in canonical column order', () => {
    const createdAtIndex = supplierOrdersAllColumns.indexOf('createdAt');
    const deliveryDateIndex = supplierOrdersAllColumns.indexOf('deliveryDate');
    expect(createdAtIndex).toBeGreaterThan(-1);
    expect(deliveryDateIndex).toBeGreaterThan(createdAtIndex);
    expect(
      normalizeSupplierOrdersColumns(
        JSON.stringify(['deliveryDate', 'createdAt', 'number']),
      ),
    ).toEqual(['number', 'createdAt', 'deliveryDate']);
  });

  it('filters by query, status, payment status, and date range', () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: 'so-2',
        number: 'SO-2',
        orderBaseId: 'SO-2',
        supplierName: 'Cable World',
        status: 'ordered',
        paymentStatus: 'paid',
        deliveryDate: '2026-05-25T10:00:00.000Z',
        items: [
          {
            lineId: 'line-2',
            itemIndex: 0,
            productName: 'HDMI adapter',
            quantity: 1,
            price: 200,
          },
        ],
      }),
    ];

    expect(
      filterSupplierOrders(orders, {
        query: 'adapter',
        selectedStatuses: ['ordered'],
      paymentStatus: 'paid',
      deliveryDateFrom: '2026-05-20',
      deliveryDateTo: '2026-05-30',
      favoritesOnly: false,
    }).map((order) => order.id),
  ).toEqual(['so-2']);
  });

  it('keeps partially_stocked orders visible when approved status filter is active', () => {
    const orders = [
      makeOrder({
        id: 'so-partial',
        status: 'partially_stocked',
        items: [
          {
            lineId: 'line-1',
            itemIndex: 0,
            productName: 'Cable A',
            quantity: 1,
            price: 100,
            receiptStatus: 'cancelled',
          },
          {
            lineId: 'line-2',
            itemIndex: 1,
            productName: 'Cable B',
            quantity: 1,
            price: 50,
            receiptStatus: 'new',
          },
        ],
      }),
    ];

    expect(
      filterSupplierOrders(orders, {
        query: '',
        selectedStatuses: ['approved'],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }).map((order) => order.id),
    ).toEqual(['so-partial']);
  });

  it('hides unpaid orders only when every item is cancelled', () => {
    const fullyCancelled = makeOrder({
      id: 'so-hidden',
      status: 'cancelled',
      paymentStatus: 'pending',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable A',
          quantity: 1,
          price: 100,
          receiptStatus: 'cancelled',
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Cable B',
          quantity: 1,
          price: 50,
          receiptStatus: 'cancelled',
        },
      ],
    });

    expect(
      areAllSupplierOrderItemsCancelled(fullyCancelled),
    ).toBe(true);
    expect(
      isSupplierOrderHiddenFromList(fullyCancelled, {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }),
    ).toBe(true);
    expect(
      filterSupplierOrders([fullyCancelled], {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }),
    ).toEqual([]);
    expect(
      filterSupplierOrders([fullyCancelled], {
        query: '',
        selectedStatuses: ['cancelled'],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }).map((order) => order.id),
    ).toEqual(['so-hidden']);
  });

  it('keeps fully cancelled paid orders visible in the list', () => {
    const paidCancelled = makeOrder({
      id: 'so-paid-cancelled',
      status: 'cancelled',
      paymentStatus: 'paid',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable A',
          quantity: 1,
          price: 100,
          receiptStatus: 'cancelled',
        },
      ],
    });

    expect(
      isSupplierOrderHiddenFromList(paidCancelled, {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }),
    ).toBe(false);
    expect(
      filterSupplierOrders([paidCancelled], {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: false,
      }).map((order) => order.id),
    ).toEqual(['so-paid-cancelled']);
  });

  it('matches partially_completed orders against stocked and approved filters', () => {
    expect(
      matchesSupplierOrderStatusFilter('partially_completed', ['approved']),
    ).toBe(true);
    expect(
      matchesSupplierOrderStatusFilter('partially_completed', ['stocked']),
    ).toBe(true);
    expect(
      matchesSupplierOrderStatusFilter('partially_completed', ['cancelled']),
    ).toBe(false);
  });

  it('filters to starred supplier orders only', () => {
    const orders = [
      makeOrder(),
      makeOrder({
        id: 'so-2',
        number: 'SO-2',
        orderBaseId: 'SO-2',
        isFavorite: true,
      }),
    ];

    expect(
      filterSupplierOrders(orders, {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: true,
      }).map((order) => order.id),
    ).toEqual(['so-2']);
  });

  it('excludes orders with non-strict favorite values from starred filter', () => {
    const orders = [
      makeOrder({
        id: 'so-truthy',
        isFavorite: 1 as unknown as boolean,
      }),
      makeOrder({
        id: 'so-starred',
        isFavorite: true,
      }),
    ];

    expect(
      filterSupplierOrders(orders, {
        query: '',
        selectedStatuses: [],
        paymentStatus: 'all',
        deliveryDateFrom: '',
        deliveryDateTo: '',
        favoritesOnly: true,
      }).map((order) => order.id),
    ).toEqual(['so-starred']);
  });

  it('builds a single row for one-item orders', () => {
    const rows = buildSupplierOrderTableRows(makeOrder({ number: 'SO-7' }), new Set());

    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'single',
        id: 'SO-7',
      }),
    ]);
  });

  it('builds collapsed parent row for multi-item orders', () => {
    const order = makeOrder({
      id: 'so-7',
      number: 'SO-7',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });

    const rows = buildSupplierOrderTableRows(order, new Set());

    expect(rows.map((row) => ({ kind: row.kind, id: row.id }))).toEqual([
      { kind: 'parent', id: 'SO-7' },
    ]);
  });

  it('builds parent and child rows when multi-item order is expanded', () => {
    const order = makeOrder({
      id: 'so-7',
      number: 'SO-7',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });

    const rows = buildSupplierOrderTableRows(order, new Set(['so-7']));

    expect(
      rows.map((row) =>
        row.kind === 'child'
          ? { kind: row.kind, id: row.id, label: row.label }
          : { kind: row.kind, id: row.id },
      ),
    ).toEqual([
      { kind: 'parent', id: 'SO-7' },
      { kind: 'child', id: 'so-7-item-0', label: '1' },
      { kind: 'child', id: 'so-7-item-1', label: '2' },
    ]);
  });

  it('summarizes multi-item order quantities', () => {
    expect(
      summarizeSupplierOrderItems(
        makeOrder({
          items: [
            {
              lineId: 'line-1',
              itemIndex: 0,
              productName: 'Cable',
              quantity: 1,
              price: 10,
            },
            {
              lineId: 'line-2',
              itemIndex: 1,
              productName: 'Adapter',
              quantity: 2,
              price: 20,
            },
          ],
        }),
      ),
    ).toEqual({
      count: 2,
      totalQuantity: 3,
    });
  });

  it('returns only active supplier order items', () => {
    expect(
      getActiveSupplierOrderItems(
        makeOrder({
          items: [
            {
              lineId: 'line-1',
              itemIndex: 0,
              productName: 'Cable',
              quantity: 1,
              price: 10,
              receiptStatus: 'received',
            },
            {
              lineId: 'line-2',
              itemIndex: 1,
              productName: 'Adapter',
              quantity: 2,
              price: 20,
            },
            {
              lineId: 'line-3',
              itemIndex: 2,
              productName: 'Hub',
              quantity: 1,
              price: 30,
              receiptStatus: 'cancelled',
            },
          ],
        }),
      ).map((item) => item.itemIndex),
    ).toEqual([1]);
  });

  it('opens supplier order status menu below the badge when space allows', () => {
    const position = computeSupplierOrderStatusMenuPosition(
      { top: 100, bottom: 132, left: 48, width: 120 },
      { width: 1280, height: 900 },
    );

    expect(position.placement).toBe('below');
    expect(position.top).toBe(136);
    expect(position.left).toBe(48);
    expect(position.maxHeight).toBe(220);
  });

  it('flips supplier order status menu above the badge near the page bottom', () => {
    const position = computeSupplierOrderStatusMenuPosition(
      { top: 820, bottom: 852, left: 900, width: 120 },
      { width: 1280, height: 900 },
    );

    expect(position.placement).toBe('above');
    expect(position.top).toBeLessThan(820);
    expect(position.left).toBe(900);
    expect(position.maxHeight).toBeLessThanOrEqual(220);
  });

  it('clamps supplier order status menu horizontally inside the viewport', () => {
    const position = computeSupplierOrderStatusMenuPosition(
      { top: 200, bottom: 232, left: 1200, width: 120 },
      { width: 1280, height: 900 },
    );

    expect(position.left).toBeLessThan(1200);
    expect(position.left + 210).toBeLessThanOrEqual(1280 - 8);
  });
});
