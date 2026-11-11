import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sale } from '../sale/model';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from '../supplier-order/model';
import * as yearlyDump from '../archive/yearly-dump';
import {
  getOrdersProcurementReport,
  getOrdersRepairsReport,
  getOrdersSalesReport,
} from './orders-report';
import { formatKievDateKey, resolveBoundedPeriodWithPrevious } from './period-utils';

const mockSelectLean = (rows: unknown) => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
});

describe('Europe/Kiev period bounds and Orders reports', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(yearlyDump, 'coldSalesPurgedExist').mockResolvedValue(false);
  });

  it('handles Europe/Kiev calendar boundaries and disables comparison for whole/all-time', () => {
    // 2026-10-15T21:30Z is 2026-10-16 00:30 in Europe/Kiev (UTC+3 DST)
    const kievLateNight = new Date('2026-10-15T21:30:00.000Z');
    expect(formatKievDateKey(kievLateNight)).toBe('2026-10-16');

    const last30 = resolveBoundedPeriodWithPrevious(
      { period: 'last30' },
      { now: kievLateNight },
    );
    expect(last30.current.dateFrom).toBe('2026-09-17');
    expect(last30.current.dateTo).toBe('2026-10-16');
    expect(last30.previous).toEqual(
      expect.objectContaining({
        dateFrom: '2026-08-18',
        dateTo: '2026-09-16',
        dayCount: 30,
      }),
    );

    const whole = resolveBoundedPeriodWithPrevious(
      { period: 'whole' },
      { now: kievLateNight },
    );
    expect(whole.previous).toBeNull();
  });

  it('computes Repairs open workload, aging, and turnaround ONLY from structured completion history', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: { toString: () => 'r-open-unassigned' },
          recordNumber: 'R000001',
          saleDate: new Date('2026-10-10T10:00:00.000Z'), // 10 days open
          status: 'inRepair',
          master: null,
          lineItems: [],
        },
        {
          _id: { toString: () => 'r-closed-tracked' },
          recordNumber: 'R000002',
          saleDate: new Date('2026-10-15T10:00:00.000Z'),
          completedAt: new Date('2026-10-16T10:00:00.000Z'), // 24 hours
          status: 'issued',
          master: { toString: () => 'm1' },
          masterSnapshot: { name: 'Oleh' },
          lineItems: [],
        },
        {
          _id: { toString: () => 'r-closed-legacy' },
          recordNumber: 'R000003',
          saleDate: new Date('2026-10-14T10:00:00.000Z'),
          updatedAt: new Date('2026-10-19T10:00:00.000Z'), // must NEVER be used
          completedAt: null,
          statusTransitions: [],
          status: 'issued',
          master: { toString: () => 'm1' },
          masterSnapshot: { name: 'Oleh' },
          lineItems: [],
        },
      ]) as never,
    );

    const report = await getOrdersRepairsReport({ period: 'last30' }, now);
    expect(report.summary.openCount).toBe(1);
    expect(report.summary.unassignedOpenCount).toBe(1);
    expect(report.summary.trackedCompletedCount).toBe(1);
    expect(report.summary.untrackedCompletedCount).toBe(1);
    expect(report.summary.avgTurnaroundHours).toBe(24);
    expect(report.turnaroundCoverage.available).toBe(true);
    expect(report.turnaroundCoverage.coveragePct).toBe(50);
    expect(report.openAgingBuckets.find((b) => b.bucket === '8-14')?.count).toBe(1);
  });

  it('computes Sales revenue, discounts, AOV, mix, and returns cleanly', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    vi.spyOn(Sale, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: { toString: () => 's1' },
          recordNumber: 'S000001',
          saleDate: new Date('2026-10-18T10:00:00.000Z'),
          status: 'issued',
          salePrice: 1000,
          quantity: 2,
          paidAmount: 900,
          discount: { mode: 'percent', value: 10 },
          lineItems: [
            { id: '1', kind: 'product', name: 'SSD', price: 800, quantity: 1 },
            { id: '2', kind: 'service', name: 'Install', price: 200, quantity: 1 },
          ],
          returnEvents: [
            {
              id: 'ret-1',
              quantity: 1,
              grossAmount: 200,
              refundAmount: 200,
              returnedAt: new Date('2026-10-19T10:00:00.000Z'),
            },
          ],
        },
        {
          _id: { toString: () => 's-prev' },
          recordNumber: 'S000000',
          saleDate: new Date('2026-09-10T10:00:00.000Z'),
          status: 'paid',
          salePrice: 500,
          quantity: 1,
          paidAmount: 500,
          discount: { mode: 'amount', value: 0 },
          lineItems: [{ id: '1', kind: 'product', name: 'Mouse', price: 500, quantity: 1 }],
        },
      ]) as never,
    );

    const report = await getOrdersSalesReport({ period: 'last30' }, { now });
    expect(report.summary.ordersCount).toBe(1);
    expect(report.summary.grossRevenue).toBe(1000);
    expect(report.summary.discountAmount).toBe(100);
    expect(report.summary.netRevenue).toBe(900);
    expect(report.summary.aov).toBe(900);
    expect(report.summary.returnsCount).toBe(1);
    expect(report.summary.returnedAmount).toBe(200);
    expect(report.mix.productRevenue).toBe(720);
    expect(report.mix.serviceRevenue).toBe(180);
    expect(report.comparison?.netRevenuePrev).toBe(500);
  });

  it('computes Procurement spend, overdue, price variation, and structured receipt lead-time performance', async () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    vi.spyOn(Supplier, 'find').mockReturnValue(
      mockSelectLean([{ _id: { toString: () => 'sup-1' }, name: 'Parts Co' }]) as never,
    );
    vi.spyOn(SupplierOrder, 'find').mockReturnValue(
      mockSelectLean([
        {
          _id: { toString: () => 'so-1' },
          orderBaseId: 'SO-1',
          number: 'PO-1',
          supplier: { toString: () => 'sup-1' },
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
          deliveryDate: new Date('2026-10-05T10:00:00.000Z'),
          status: 'stocked',
          paymentStatus: 'paid',
          receiptStatus: 'received',
          total: 1000,
          paid: 1000,
          items: [
            {
              productName: 'Battery',
              quantity: 5,
              price: 200,
              receiptStatus: 'received',
              receivedAt: new Date('2026-10-04T10:00:00.000Z'), // 3 days lead, on time
            },
          ],
        },
        {
          _id: { toString: () => 'so-2' },
          orderBaseId: 'SO-2',
          number: 'PO-2',
          supplier: { toString: () => 'sup-1' },
          createdAt: new Date('2026-10-10T10:00:00.000Z'),
          deliveryDate: new Date('2026-10-15T10:00:00.000Z'), // past -> overdue
          status: 'overdue',
          paymentStatus: 'pending',
          receiptStatus: 'new',
          total: 600,
          paid: 0,
          items: [
            {
              productName: 'Battery',
              quantity: 2,
              price: 300,
              receiptStatus: 'new',
            },
          ],
        },
      ]) as never,
    );

    const report = await getOrdersProcurementReport({ period: 'last30' }, now);
    expect(report.summary.ordersCount).toBe(2);
    expect(report.summary.totalSpend).toBe(1600);
    expect(report.summary.paidAmount).toBe(1000);
    expect(report.summary.outstandingAmount).toBe(600);
    expect(report.summary.overdueOrdersCount).toBe(1);
    expect(report.receiptPerformance.trackedItemsCount).toBe(1);
    expect(report.receiptPerformance.onTimeRatePct).toBe(100);
    expect(report.receiptPerformance.avgReceiptLeadDays).toBe(3);

    const bat = report.byProduct.find((p) => p.productName === 'Battery')!;
    expect(bat.minPrice).toBe(200);
    expect(bat.maxPrice).toBe(300);
    expect(bat.priceVariationPct).toBe(50);
  });
});
