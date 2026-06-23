import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { buildDashboardAnalytics, getSaleTotal } from './sales-analytics';

const baseSale: Sale = {
  id: 's1',
  recordNumber: null,
  saleDate: '2026-05-12T10:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'issued',
  paidAmount: 100,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'c1',
    name: 'Client',
    phone: '',
    status: 'new',
  },
  product: {
    id: 'p1',
    article: 'A1',
    name: 'Product',
    serialNumber: 'S1',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-05-12T10:00:00.000Z',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

const baseProduct: Product = {
  id: 'p1',
  name: 'Product',
  article: 'A1',
  serialNumber: 'S1',
  price: 60,
  salePriceOptions: [100],
  note: '',
  quantity: 3,
  reservedQuantity: 1,
  freeQuantity: 2,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'w1',
  locationId: 'l1',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

describe('sales analytics', () => {
  it('uses line items and discounts for sale totals', () => {
    const total = getSaleTotal({
      ...baseSale,
      salePrice: 999,
      quantity: 9,
      lineItems: [
        {
          id: 'i1',
          kind: 'product',
          name: 'Part',
          price: 80,
          quantity: 2,
          warrantyPeriod: 0,
        },
        {
          id: 'i2',
          kind: 'service',
          name: 'Work',
          price: 40,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
      discount: { mode: 'amount', value: 20 },
    });

    expect(total).toBe(180);
  });

  it('builds current-month revenue, payment and stock metrics', () => {
    const analytics = buildDashboardAnalytics(
      [
        {
          ...baseSale,
          id: 's1',
          paidAmount: 50,
          lineItems: [
            {
              id: 'i1',
              kind: 'product',
              name: 'Product',
              price: 120,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      [
        {
          ...baseSale,
          id: 'r1',
          kind: 'repair',
          status: 'inRepair',
          paidAmount: 20,
          lineItems: [
            {
              id: 'i2',
              kind: 'service',
              name: 'Repair',
              price: 80,
              quantity: 1,
              warrantyPeriod: 0,
            },
          ],
        },
      ],
      'currentMonth',
      [baseProduct],
      new Date('2026-05-29T12:00:00.000Z'),
    );

    expect(analytics.revenueSnapshots[0].total).toBe(120);
    expect(analytics.orderSnapshots[0].total).toBe(1);
    expect(analytics.operations.paidAmount).toBe(70);
    expect(analytics.operations.remainingAmount).toBe(130);
    expect(analytics.operations.openOrders).toBe(1);
    expect(analytics.operations.closedOrders).toBe(1);
    expect(analytics.stock.freeStock).toBe(2);
    expect(analytics.stock.stockValue).toBe(180);
  });

  it('filters analytics by custom date range with a single chart series', () => {
    const analytics = buildDashboardAnalytics(
      [{ ...baseSale, saleDate: '2026-06-05T10:00:00.000Z', salePrice: 100, quantity: 1 }],
      [],
      'today',
      [],
      new Date('2026-06-10T12:00:00.000Z'),
      { dateFrom: '2026-06-01', dateTo: '2026-06-10' },
    );

    expect(analytics.revenueSnapshots).toHaveLength(1);
    expect(analytics.revenueSnapshots[0].total).toBe(100);
    expect(analytics.hasRevenueData).toBe(true);
  });

  it('returns stable empty-state values without records', () => {
    const analytics = buildDashboardAnalytics(
      [],
      [],
      'today',
      [],
      new Date('2026-05-29T12:00:00.000Z'),
    );

    expect(analytics.hasRevenueData).toBe(false);
    expect(analytics.hasOrdersData).toBe(false);
    expect(analytics.operations.paymentCoverage).toBe(0);
    expect(analytics.operations.remainingAmount).toBe(0);
    expect(analytics.stock.productCount).toBe(0);
  });
});
