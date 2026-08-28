import { describe, expect, it } from 'vitest';
import {
  getCashSplit,
  getConsecutivePreviousBounds,
  getDeltaPct,
  getRepairFunnel,
} from './analytics-aggregates';
import { isSparseValues, buildStackedBarRects } from './sales-analytics';

describe('frontend analytics aggregates', () => {
  it('computes consecutive previous month bounds', () => {
    const bounds = getConsecutivePreviousBounds('currentMonth', new Date(2026, 7, 28));
    expect(bounds?.start.getMonth()).toBe(6);
    expect(getDeltaPct(280, 100)).toBe(180);
    expect(getDeltaPct(10, 0)).toBeNull();
  });

  it('keeps refunded cash from going negative in the split', () => {
    const split = getCashSplit([
      {
        paidAmount: 20,
        paymentHistory: [
          { type: 'deposit', paymentMethod: 'cash', amount: 20 },
          { type: 'refund', paymentMethod: 'cash', amount: 5 },
        ],
      },
    ]);
    expect(split.cashCollected).toBe(15);
    expect(split.unspecifiedCollected).toBe(5);
  });

  it('builds stacked bar geometry and sparse detection', () => {
    expect(isSparseValues([0, 0, 10, 0, 0, 0])).toBe(true);
    expect(isSparseValues([10, 12, 8, 9])).toBe(false);
    const bars = buildStackedBarRects([10, 0], [5, 20], 20, 200, 100, {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
    });
    expect(bars).toHaveLength(2);
    expect(bars[0].product.value).toBe(10);
    expect(bars[0].repair.value).toBe(5);
  });

  it('counts open funnel statuses', () => {
    const funnel = getRepairFunnel(
      [{ status: 'ready' }, { status: 'issued' }, { status: 'inRepair' }],
      (sale) => sale.status === 'issued',
    );
    expect(funnel.find((item) => item.status === 'ready')?.count).toBe(1);
    expect(funnel.find((item) => item.status === 'inRepair')?.count).toBe(1);
  });
});
