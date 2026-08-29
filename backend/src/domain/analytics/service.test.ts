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
    expect(result.metrics.productRevenue).toBe(100);
    expect(result.metrics.repairRevenue).toBe(50);
    expect(result.metrics.billed).toBe(150);
    expect(result.metrics.revenue).toBe(150);
    expect(result.metrics.openOrders).toBe(1);
    expect(result.metrics.readyCount).toBe(0);
    expect(result.funnel.find((item) => item.status === 'new')?.count).toBe(1);
    expect(result.stock.productCount).toBe(2);
    expect(result.stock.freeStock).toBe(4);
    expect(result.hasRevenueData).toBe(true);
    expect(result.revenueSnapshots[0]?.values.length).toBe(24);
    expect(result.productRevenueSnapshots[0]?.total).toBe(100);
    expect(result.repairRevenueSnapshots[0]?.total).toBe(50);
    expect(result.dataScope).toBe('live_sales_only');
    expect(result.coldSalesPurgedExist).toBe(false);
  });

  it('splits cash, funnel and top line items for the selected period', async () => {
    const now = new Date('2026-08-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const leanSales = vi.fn().mockResolvedValue([
      {
        saleDate: new Date('2026-08-10T10:00:00.000Z'),
        kind: 'sale',
        status: 'paid',
        paidAmount: 200,
        salePrice: 200,
        quantity: 1,
        isRapidSale: true,
        lineItems: [{ kind: 'product', productId: 'p1', name: 'Screen', price: 200, quantity: 1 }],
        discount: { mode: 'amount', value: 0 },
        paymentHistory: [{ type: 'deposit', paymentMethod: 'non-cash', amount: 200 }],
      },
      {
        saleDate: new Date('2026-08-11T10:00:00.000Z'),
        kind: 'repair',
        status: 'waitingParts',
        paidAmount: 40,
        salePrice: 80,
        quantity: 1,
        isRapidSale: false,
        lineItems: [{ kind: 'service', serviceId: 's1', name: 'Diagnostics', price: 80, quantity: 1 }],
        discount: { mode: 'amount', value: 0 },
        paymentHistory: [{ type: 'deposit', paymentMethod: 'cash', amount: 40 }],
      },
      {
        saleDate: new Date('2026-07-02T10:00:00.000Z'),
        kind: 'sale',
        status: 'paid',
        paidAmount: 100,
        salePrice: 100,
        quantity: 1,
        lineItems: [{ kind: 'product', productId: 'p2', name: 'Old', price: 100, quantity: 1 }],
        discount: { mode: 'amount', value: 0 },
        paymentHistory: [{ type: 'deposit', paymentMethod: 'cash', amount: 100 }],
      },
    ]);
    vi.spyOn(Sale, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: leanSales }),
    } as never);
    vi.spyOn(Product, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
    } as never);

    const result = await getDashboardAnalytics({ period: 'currentMonth' });

    expect(result.metrics.billed).toBe(280);
    expect(result.metrics.cashCollected).toBe(40);
    expect(result.metrics.nonCashCollected).toBe(200);
    expect(result.metrics.rapidSaleCount).toBe(1);
    expect(result.metrics.previous?.billed).toBe(100);
    expect(result.metrics.deltas?.billedPct).toBe(180);
    expect(result.topLineItems.products[0]?.name).toBe('Screen');
    expect(result.topLineItems.services[0]?.name).toBe('Diagnostics');
    expect(result.funnel.find((item) => item.status === 'waitingParts')?.count).toBe(1);
    expect(result.metrics.waitingPartsCount).toBe(1);
  });
});
