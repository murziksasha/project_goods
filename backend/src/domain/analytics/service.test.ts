import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import * as yearlyDump from '../archive/yearly-dump';
import { getDashboardAnalytics } from './service';

describe('getDashboardAnalytics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);
  });

  it('aggregates sales and repair metrics for today period', async () => {
    const now = new Date('2026-07-28T15:30:00.000Z');
    vi.setSystemTime(now);

    const leanSales = vi.fn().mockResolvedValue([
      {
        saleDate: new Date('2026-07-28T10:00:00.000Z'),
        kind: 'sale',
        status: 'paid',
        paidAmount: 100,
        salePrice: 100,
        quantity: 1,
        lineItems: [{ price: 100, quantity: 1 }],
        discount: { mode: 'amount', value: 0 },
      },
      {
        saleDate: new Date('2026-07-28T11:00:00.000Z'),
        kind: 'repair',
        status: 'new',
        paidAmount: 0,
        salePrice: 50,
        quantity: 1,
        lineItems: [{ price: 50, quantity: 1 }],
        discount: { mode: 'amount', value: 0 },
      },
    ]);
    const selectSales = vi.fn().mockReturnValue({ lean: leanSales });
    vi.spyOn(Sale, 'find').mockReturnValue({ select: selectSales } as never);

    const leanProducts = vi.fn().mockResolvedValue([
      { quantity: 5, reservedQuantity: 1, price: 10 },
      { quantity: 0, reservedQuantity: 0, price: 20 },
    ]);
    const selectProducts = vi.fn().mockReturnValue({ lean: leanProducts });
    vi.spyOn(Product, 'find').mockReturnValue({ select: selectProducts } as never);

    const result = await getDashboardAnalytics({ period: 'today' });

    expect(result.metrics.salesCount).toBe(1);
    expect(result.metrics.ordersCount).toBe(1);
    expect(result.metrics.revenue).toBe(100);
    expect(result.metrics.openOrders).toBe(1);
    expect(result.stock.productCount).toBe(2);
    expect(result.stock.freeStock).toBe(4);
    expect(result.hasRevenueData).toBe(true);
    expect(result.revenueSnapshots[0]?.values.length).toBe(24);
    expect(result.dataScope).toBe('live_sales_only');
    expect(result.coldSalesPurgedExist).toBe(false);
  });
});
