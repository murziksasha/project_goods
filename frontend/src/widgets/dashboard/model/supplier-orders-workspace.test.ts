import { describe, expect, it } from 'vitest';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  buildGroupedSupplierOrderView,
  filterSupplierOrders,
  normalizeSupplierOrdersColumns,
  parseSupplierOrdersFilters,
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

  it('builds grouped item rows with display numbers', () => {
    const rows = buildGroupedSupplierOrderView(
      makeOrder({
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
      }),
    );

    expect(rows.map((row) => row.id)).toEqual(['SO-7-1', 'SO-7-2']);
  });
});
