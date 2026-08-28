import { describe, expect, it } from 'vitest';
import {
  getCashSplit,
  getConsecutivePreviousBounds,
  getDeltaPct,
  getRepairFunnel,
  getTopLineItems,
  isDateInBounds,
} from './aggregates';

describe('analytics aggregates', () => {
  it('computes cash split with refunds and unspecified remainder', () => {
    const split = getCashSplit([
      {
        paidAmount: 120,
        paymentHistory: [
          { type: 'deposit', paymentMethod: 'cash', amount: 80 },
          { type: 'deposit', paymentMethod: 'non-cash', amount: 50 },
          { type: 'refund', paymentMethod: 'cash', amount: 10 },
        ],
      },
      {
        paidAmount: 30,
        paymentHistory: [],
      },
    ]);

    expect(split.cashCollected).toBe(70);
    expect(split.nonCashCollected).toBe(50);
    expect(split.unspecifiedCollected).toBe(30);
  });

  it('builds funnel for open kanban statuses and other', () => {
    const isFinal = (sale: { status?: string }) =>
      sale.status === 'issued' || sale.status === 'clientRejected';
    const funnel = getRepairFunnel(
      [
        { status: 'new' },
        { status: 'new' },
        { status: 'waitingParts' },
        { status: 'ready' },
        { status: 'issued' },
        { status: 'mystery' },
      ],
      isFinal,
    );

    expect(funnel.find((item) => item.status === 'new')?.count).toBe(2);
    expect(funnel.find((item) => item.status === 'waitingParts')?.count).toBe(1);
    expect(funnel.find((item) => item.status === 'ready')?.count).toBe(1);
    expect(funnel.find((item) => item.status === 'other')?.count).toBe(1);
    expect(funnel.find((item) => item.status === 'issued')).toBeUndefined();
  });

  it('ranks top products and services by amount', () => {
    const top = getTopLineItems(
      [
        {
          lineItems: [
            { kind: 'product', productId: 'p1', name: 'Screen', price: 100, quantity: 2 },
            { kind: 'service', serviceId: 's1', name: 'Repair', price: 80, quantity: 1 },
          ],
        },
        {
          lineItems: [
            { kind: 'product', productId: 'p1', name: 'Screen', price: 100, quantity: 1 },
            { kind: 'product', name: 'Cable', price: 20, quantity: 1 },
          ],
        },
      ],
      5,
    );

    expect(top.products[0]).toMatchObject({ name: 'Screen', quantity: 3, amount: 300 });
    expect(top.services[0]).toMatchObject({ name: 'Repair', quantity: 1, amount: 80 });
  });

  it('returns previous month bounds for currentMonth', () => {
    const bounds = getConsecutivePreviousBounds('currentMonth', new Date(2026, 7, 28));
    expect(bounds).not.toBeNull();
    expect(bounds?.start.getMonth()).toBe(6);
    expect(bounds?.start.getDate()).toBe(1);
    expect(isDateInBounds(new Date(2026, 6, 15), bounds!)).toBe(true);
    expect(isDateInBounds(new Date(2026, 7, 1), bounds!)).toBe(false);
  });

  it('hides delta when previous is zero', () => {
    expect(getDeltaPct(100, 0)).toBeNull();
    expect(getDeltaPct(120, 100)).toBe(20);
  });
});
