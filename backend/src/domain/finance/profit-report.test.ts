import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import * as yearlyDump from '../archive/yearly-dump';
import { FinanceTransaction } from './model';
import {
  allocateLineRevenues,
  buildProfitCashSummary,
  buildProfitMarginRows,
  getFinanceProfitReport,
  isStockCommittedSale,
  resolveProfitReportBounds,
  resolveTransactionCategory,
} from './profit-report';

describe('profit report helpers', () => {
  it('resolves period bounds in Europe/Kiev calendar dates', () => {
    const now = new Date('2026-09-16T21:30:00.000Z');
    expect(resolveProfitReportBounds({ period: 'whole' }, now)).toEqual({
      key: 'whole',
      dateFrom: null,
      dateTo: null,
    });
    expect(resolveProfitReportBounds({ period: 'day' }, now)).toEqual({
      key: 'day',
      dateFrom: '2026-09-17',
      dateTo: '2026-09-17',
    });
    expect(resolveProfitReportBounds({ period: 'week' }, now)).toEqual({
      key: 'week',
      dateFrom: '2026-09-14',
      dateTo: '2026-09-20',
    });
    expect(resolveProfitReportBounds({ period: 'month' }, now)).toEqual({
      key: 'month',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
    });
    expect(resolveProfitReportBounds({ period: 'year' }, now)).toEqual({
      key: 'year',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
    expect(
      resolveProfitReportBounds(
        { dateFrom: '2026-08-02', dateTo: '2026-08-01' },
        now,
      ),
    ).toEqual({
      key: 'custom',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-02',
    });
  });

  it('allocates order-level discount across line items', () => {
    expect(
      allocateLineRevenues(
        [
          { price: 100, quantity: 1 },
          { price: 100, quantity: 1 },
        ],
        { mode: 'percent', value: 10 },
      ),
    ).toEqual([90, 90]);
    expect(
      allocateLineRevenues(
        [
          { price: 200, quantity: 1 },
          { price: 100, quantity: 1 },
        ],
        { mode: 'amount', value: 30 },
      ),
    ).toEqual([180, 90]);
  });

  it('builds margin rows by SKU with service cost 0 and unknown product cost flagged', () => {
    const { rows, unknownCostCount } = buildProfitMarginRows(
      [
        {
          kind: 'sale',
          status: 'issued',
          discount: { mode: 'percent', value: 0 },
          lineItems: [
            {
              kind: 'product',
              name: 'Screen',
              price: 500,
              quantity: 1,
              productId: 'p1',
            },
            {
              kind: 'service',
              name: 'Diagnostics',
              price: 200,
              quantity: 1,
              serviceId: 's1',
            },
          ],
        },
        {
          kind: 'repair',
          status: 'issued',
          lineItems: [
            {
              kind: 'product',
              name: 'Missing part',
              price: 50,
              quantity: 1,
              productId: 'missing',
            },
          ],
        },
      ],
      { p1: 300 },
      'all',
    );

    expect(unknownCostCount).toBe(1);
    expect(rows.find((row) => row.name === 'Screen')).toMatchObject({
      type: 'product',
      cost: 300,
      revenue: 500,
      profit: 200,
      marginPct: 40,
      costKnown: true,
    });
    expect(rows.find((row) => row.name === 'Diagnostics')).toMatchObject({
      type: 'service',
      cost: 0,
      revenue: 200,
      profit: 200,
      costKnown: true,
    });
    expect(rows.find((row) => row.name === 'Missing part')).toMatchObject({
      costKnown: false,
      revenue: 50,
    });
  });

  it('filters margin rows by source', () => {
    const sales = [
      {
        kind: 'sale' as const,
        status: 'issued',
        lineItems: [
          { kind: 'product', name: 'Cable', price: 100, quantity: 1, productId: 'p1' },
          { kind: 'service', name: 'Install', price: 40, quantity: 1, serviceId: 's1' },
        ],
      },
    ];
    expect(buildProfitMarginRows(sales, { p1: 20 }, 'sales').rows).toHaveLength(1);
    expect(buildProfitMarginRows(sales, { p1: 20 }, 'sales').rows[0]?.type).toBe(
      'product',
    );
    expect(buildProfitMarginRows(sales, { p1: 20 }, 'services').rows[0]?.type).toBe(
      'service',
    );
  });

  it('splits cash buckets and ignores transfers, cancelled, and reversal rows', () => {
    const summary = buildProfitCashSummary([
      {
        type: 'deposit',
        amount: 1000,
        currency: 'UAH',
        note: 'Payment for order r000001',
        category: 'client_payment',
        status: 'active',
        transactionDate: '2026-09-01T10:00:00.000Z',
      },
      {
        type: 'withdraw',
        amount: 400,
        currency: 'UAH',
        note: 'Supplier order payment: SO-1',
        category: 'supplier_payment',
        status: 'active',
        transactionDate: '2026-09-01T11:00:00.000Z',
      },
      {
        type: 'withdraw',
        amount: 150,
        currency: 'UAH',
        note: 'Office rent',
        category: 'rent',
        status: 'active',
        transactionDate: '2026-09-01T12:00:00.000Z',
      },
      {
        type: 'withdraw',
        amount: 50,
        currency: 'UAH',
        note: 'Refund for order r000001',
        category: 'client_refund',
        status: 'active',
        transactionDate: '2026-09-01T13:00:00.000Z',
      },
      {
        type: 'transfer',
        amount: 80,
        currency: 'UAH',
        note: 'Move',
        status: 'active',
        transactionDate: '2026-09-01T14:00:00.000Z',
      },
      {
        type: 'withdraw',
        amount: 20,
        currency: 'UAH',
        note: 'Cancelled rent',
        category: 'rent',
        status: 'cancelled',
        transactionDate: '2026-09-01T15:00:00.000Z',
      },
      {
        type: 'deposit',
        amount: 20,
        currency: 'UAH',
        note: 'Cancellation',
        isCancellation: true,
        status: 'active',
        transactionDate: '2026-09-01T15:00:00.000Z',
      },
    ]);

    expect(summary.collected).toBe(1000);
    expect(summary.inventoryPurchases).toBe(400);
    expect(summary.opex).toBe(150);
    expect(summary.refunds).toBe(50);
    expect(summary.net).toBe(400);
    expect(summary.opexByCategory).toEqual([
      { category: 'rent', amount: 150, count: 1 },
    ]);
  });

  it('infers category from notes when the stored field is missing', () => {
    expect(
      resolveTransactionCategory({
        type: 'deposit',
        note: 'Payment for order r1',
      }),
    ).toBe('client_payment');
    expect(isStockCommittedSale({ kind: 'sale', status: 'new' })).toBe(false);
    expect(isStockCommittedSale({ kind: 'sale', status: 'issued' })).toBe(true);
    expect(isStockCommittedSale({ kind: 'repair', status: 'paid' })).toBe(false);
    expect(isStockCommittedSale({ kind: 'repair', status: 'issued' })).toBe(true);
  });
});

describe('getFinanceProfitReport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);
  });

  it('aggregates committed sales and cash movements for the selected period', async () => {
    const now = new Date('2026-09-15T12:00:00.000Z');
    vi.setSystemTime(now);

    const leanSales = vi.fn().mockResolvedValue([
      {
        saleDate: new Date('2026-09-15T10:00:00.000Z'),
        kind: 'sale',
        status: 'issued',
        salePrice: 500,
        quantity: 1,
        discount: { mode: 'percent', value: 0 },
        lineItems: [
          {
            kind: 'product',
            name: 'Battery',
            price: 500,
            quantity: 1,
            productId: 'p1',
          },
        ],
      },
      {
        saleDate: new Date('2026-09-15T11:00:00.000Z'),
        kind: 'repair',
        status: 'new',
        salePrice: 200,
        quantity: 1,
        lineItems: [
          { kind: 'service', name: 'Diagnostics', price: 200, quantity: 1 },
        ],
      },
    ]);
    vi.spyOn(Sale, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: leanSales }),
    } as never);

    const leanTx = vi.fn().mockResolvedValue([
      {
        type: 'deposit',
        amount: 500,
        currency: 'UAH',
        note: 'Payment for order r000001',
        category: 'client_payment',
        status: 'active',
        transactionDate: new Date('2026-09-15T10:05:00.000Z'),
      },
      {
        type: 'withdraw',
        amount: 80,
        currency: 'UAH',
        note: 'Salary',
        category: 'salary',
        status: 'active',
        transactionDate: new Date('2026-09-15T12:00:00.000Z'),
      },
    ]);
    vi.spyOn(FinanceTransaction, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: leanTx }),
    } as never);

    const leanProducts = vi.fn().mockResolvedValue([
      { _id: { toString: () => 'p1' }, price: 200 },
    ]);
    vi.spyOn(Product, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: leanProducts }),
    } as never);

    const result = await getFinanceProfitReport({ period: 'day' });

    expect(result.period.key).toBe('day');
    expect(result.source).toBe('all');
    expect(result.margin.revenue).toBe(500);
    expect(result.margin.cogs).toBe(200);
    expect(result.margin.grossProfit).toBe(300);
    expect(result.cash.collected).toBe(500);
    expect(result.cash.opex).toBe(80);
    expect(result.cash.net).toBe(420);
    expect(result.saleCount).toBe(1);
    expect(result.rows[0]?.name).toBe('Battery');
    expect(result.dataScope).toBe('live_sales_only');
    expect(result.coldSalesPurgedExist).toBe(false);
  });
});
