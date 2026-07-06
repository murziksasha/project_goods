import { describe, expect, it } from 'vitest';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Supplier } from '../../../entities/supplier/model/types';
import {
  buildSupplierOrderAnalytics,
  buildSupplierOrderItemNumber,
  filterActiveSuppliers,
  getSupplierSuggestions,
  mergeSupplierOrderItemUpdate,
} from './supplier-order-utils';

const makeOrder = (): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1779142808517',
  supplierId: 'sup-1',
  supplierName: 'Supplier',
  deliveryDate: '2026-05-19',
  supplyType: 'local',
  number: 'SO-1779142808517',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 9500,
  paid: 9500,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Type C cable',
      quantity: 50,
      price: 100,
    },
    {
      lineId: 'line-2',
      itemIndex: 1,
      catalogProductId: 'cat-2',
      productName: 'Router TP-Link',
      quantity: 5,
      price: 900,
    },
  ],
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
});

describe('supplier-order-utils', () => {
  it('builds supplier order number with item postfix', () => {
    const order = makeOrder();
    expect(buildSupplierOrderItemNumber(order, 0)).toBe(
      'SO-1779142808517-1',
    );
    expect(buildSupplierOrderItemNumber(order, 1)).toBe(
      'SO-1779142808517-2',
    );
  });

  it('updates only selected item and keeps others unchanged', () => {
    const order = makeOrder();
    const merged = mergeSupplierOrderItemUpdate({
      sourceOrder: order,
      selectedItemIndex: 1,
      updatedItem: {
        lineId: 'line-updated',
        itemIndex: 0,
        catalogProductId: 'cat-2',
        productName: 'Router TP-Link WR741',
        quantity: 7,
        price: 950,
      },
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(order.items[0]);
    expect(merged[1]).toMatchObject({
      lineId: 'line-updated',
      itemIndex: 1,
      catalogProductId: 'cat-2',
      productName: 'Router TP-Link WR741',
      quantity: 7,
      price: 950,
    });
  });

  const sampleSuppliers: Supplier[] = [
    {
      id: '1',
      name: 'Remont Service',
      phone: '+3801111111',
      phones: ['+3801111111'],
      note: '',
      supplierOrder: '',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '2',
      name: 'Inactive Supplier',
      phone: '+3802222222',
      phones: ['+3802222222'],
      note: '',
      supplierOrder: '',
      isActive: false,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: '3',
      name: 'Parts Hub',
      phone: '+3803333333',
      phones: ['+3803333333'],
      note: '',
      supplierOrder: '',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ];

  it('returns active supplier suggestions by name or phone', () => {
    expect(getSupplierSuggestions(sampleSuppliers, 're')).toHaveLength(1);
    expect(getSupplierSuggestions(sampleSuppliers, '11')[0]?.id).toBe('1');
    expect(getSupplierSuggestions(sampleSuppliers, 'i')).toHaveLength(0);
  });

  it('filters active suppliers for choose modal', () => {
    expect(filterActiveSuppliers(sampleSuppliers, '')).toHaveLength(2);
    expect(filterActiveSuppliers(sampleSuppliers, 'parts')[0]?.id).toBe('3');
    expect(filterActiveSuppliers(sampleSuppliers, '380222')).toHaveLength(0);
    expect(filterActiveSuppliers(sampleSuppliers, '380111')[0]?.id).toBe('1');
  });

  it('builds totals and outstanding amount', () => {
    const analytics = buildSupplierOrderAnalytics(
      [
        makeOrder(),
        {
          ...makeOrder(),
          id: 'so-2',
          total: 500,
          paid: 100,
          items: [
            {
              lineId: 'line-3',
              itemIndex: 0,
              productName: 'HDMI cable',
              quantity: 2,
              price: 250,
            },
          ],
        },
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics.orderCount).toBe(2);
    expect(analytics.totalValue).toBe(10000);
    expect(analytics.paidAmount).toBe(9600);
    expect(analytics.outstandingAmount).toBe(400);
    expect(analytics.totalQuantity).toBe(57);
    expect(analytics.averageOrderValue).toBe(5000);
    expect(analytics.paymentCoveragePercent).toBe(96);
  });

  it('finds popular products by quantity, value, and frequency', () => {
    const order = makeOrder();
    const analytics = buildSupplierOrderAnalytics(
      [
        order,
        {
          ...order,
          id: 'so-2',
          items: [
            {
              lineId: 'line-3',
              itemIndex: 0,
              catalogProductId: 'cat-1',
              productName: 'Type C cable',
              quantity: 20,
              price: 120,
            },
            {
              lineId: 'line-4',
              itemIndex: 1,
              catalogProductId: 'cat-3',
              productName: 'SSD 1TB',
              quantity: 3,
              price: 3000,
            },
          ],
        },
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics.topProductsByQuantity[0]).toMatchObject({
      productName: 'Type C cable',
      quantity: 70,
      orderCount: 2,
    });
    expect(analytics.topProductsByValue[0]?.productName).toBe('SSD 1TB');
    expect(analytics.topProductsByFrequency[0]?.productName).toBe(
      'Type C cable',
    );
  });

  it('detects low and high unit prices plus product price ranges', () => {
    const order = makeOrder();
    const analytics = buildSupplierOrderAnalytics(
      [
        order,
        {
          ...order,
          id: 'so-2',
          number: 'SO-2',
          items: [
            {
              lineId: 'line-3',
              itemIndex: 0,
              catalogProductId: 'cat-1',
              productName: 'Type C cable',
              quantity: 5,
              price: 80,
            },
            {
              lineId: 'line-4',
              itemIndex: 1,
              productName: 'SSD 1TB',
              quantity: 1,
              price: 2500,
            },
          ],
        },
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics.lowestPricePosition).toMatchObject({
      productName: 'Type C cable',
      price: 80,
    });
    expect(analytics.highestPricePosition).toMatchObject({
      productName: 'SSD 1TB',
      price: 2500,
    });
    expect(analytics.productPriceRanges[0]).toMatchObject({
      productName: 'Type C cable',
      minPrice: 80,
      maxPrice: 100,
    });
  });

  it('summarizes supplier spend and pending amount', () => {
    const order = makeOrder();
    const analytics = buildSupplierOrderAnalytics(
      [
        order,
        {
          ...order,
          id: 'so-2',
          supplierId: 'sup-2',
          supplierName: 'Parts Hub',
          total: 12000,
          paid: 2000,
        },
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics.topSuppliersBySpend[0]).toMatchObject({
      supplierName: 'Parts Hub',
      total: 12000,
    });
    expect(analytics.topSuppliersByPending[0]).toMatchObject({
      supplierName: 'Parts Hub',
      outstanding: 10000,
    });
  });

  it('calculates overdue and late-risk orders with an injected date', () => {
    const order = makeOrder();
    const analytics = buildSupplierOrderAnalytics(
      [
        {
          ...order,
          id: 'so-overdue',
          deliveryDate: '2026-05-18T10:00:00.000Z',
          status: 'ordered',
          receiptStatus: 'new',
        },
        {
          ...order,
          id: 'so-risk',
          deliveryDate: '2026-05-22T10:00:00.000Z',
          status: 'approved',
          receiptStatus: 'new',
        },
        {
          ...order,
          id: 'so-stocked',
          deliveryDate: '2026-05-18T10:00:00.000Z',
          status: 'stocked',
          receiptStatus: 'received',
        },
      ],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics.overdueCount).toBe(1);
    expect(analytics.lateRiskCount).toBe(1);
    expect(analytics.stockedRate).toBe(33.33);
  });

  it('returns empty analytics for no supplier orders', () => {
    const analytics = buildSupplierOrderAnalytics(
      [],
      new Date('2026-05-20T00:00:00.000Z'),
    );

    expect(analytics).toMatchObject({
      orderCount: 0,
      totalValue: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      totalQuantity: 0,
      averageOrderValue: 0,
      overdueCount: 0,
      lateRiskCount: 0,
    });
    expect(analytics.topProductsByQuantity).toEqual([]);
    expect(analytics.lowestPricePosition).toBeNull();
    expect(analytics.highestPricePosition).toBeNull();
  });
});
