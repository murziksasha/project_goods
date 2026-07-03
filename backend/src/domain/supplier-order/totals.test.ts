import { describe, expect, it } from 'vitest';
import {
  applySupplierOrderFinancialTotals,
  calculateSupplierOrderPayableTotal,
} from './totals';

describe('calculateSupplierOrderPayableTotal', () => {
  it('sums only active items and excludes cancelled lines', () => {
    expect(
      calculateSupplierOrderPayableTotal([
        {
          quantity: 1,
          price: 100,
          receiptStatus: 'cancelled',
        },
        {
          quantity: 2,
          price: 25,
          receiptStatus: 'new',
        },
      ]),
    ).toBe(50);
  });

  it('returns zero when every item is cancelled', () => {
    expect(
      calculateSupplierOrderPayableTotal([
        {
          quantity: 1,
          price: 100,
          receiptStatus: 'cancelled',
        },
      ]),
    ).toBe(0);
  });
});

describe('applySupplierOrderFinancialTotals', () => {
  const items = [
    { quantity: 1, price: 100, receiptStatus: 'cancelled' },
    { quantity: 1, price: 50, receiptStatus: 'new' },
  ];

  it('zeros paid for pending orders', () => {
    expect(
      applySupplierOrderFinancialTotals({
        items,
        paymentStatus: 'pending',
        paid: 0,
      }),
    ).toEqual({ total: 50, paid: 0 });
  });

  it('sets paid to payable total when payment status becomes paid', () => {
    expect(
      applySupplierOrderFinancialTotals({
        items,
        paymentStatus: 'paid',
        paid: 0,
        isPaymentStatusModified: true,
      }),
    ).toEqual({ total: 50, paid: 50 });
  });

  it('preserves historical paid after later item cancel', () => {
    expect(
      applySupplierOrderFinancialTotals({
        items,
        paymentStatus: 'paid',
        paid: 150,
        isPaymentStatusModified: false,
      }),
    ).toEqual({ total: 50, paid: 150 });
  });
});