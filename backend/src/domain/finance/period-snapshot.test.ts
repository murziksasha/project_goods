import { describe, expect, it } from 'vitest';
import {
  computeBalancesAtPeriodEnd,
  getFinanceRawTxCutoff,
} from './period-snapshot';
import type { FinanceTransactionDocument } from './model';

describe('finance period snapshot helpers', () => {
  it('computes 36-month UTC cutoff at start of day', () => {
    const now = new Date('2026-07-28T15:45:00.000Z');
    expect(getFinanceRawTxCutoff(now).toISOString()).toBe('2023-07-28T00:00:00.000Z');
  });

  it('reverse-walks post-seal txs to recover period-end balances', () => {
    const cashboxes = [{ id: 'cb1', balances: { UAH: 150 } }];
    const txs = [
      {
        _id: { toString: () => 't2' },
        type: 'deposit',
        amount: 50,
        currency: 'UAH',
        fromCashbox: null,
        toCashbox: 'cb1',
        transactionDate: new Date('2025-01-02T00:00:00.000Z'),
        createdAt: new Date('2025-01-02T00:00:00.000Z'),
        status: 'active',
        isCancellation: false,
      },
      {
        _id: { toString: () => 't1' },
        type: 'deposit',
        amount: 100,
        currency: 'UAH',
        fromCashbox: null,
        toCashbox: 'cb1',
        transactionDate: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        status: 'active',
        isCancellation: false,
      },
    ] as unknown as FinanceTransactionDocument[];

    const balances = computeBalancesAtPeriodEnd(cashboxes, txs);
    expect(balances).toEqual([{ cashboxId: 'cb1', currency: 'UAH', amount: 0 }]);
  });

  it('preserves negative period-end amounts without silent clamp', () => {
    const cashboxes = [{ id: 'cb1', balances: { UAH: 10 } }];
    const txs = [
      {
        _id: { toString: () => 't1' },
        type: 'deposit',
        amount: 50,
        currency: 'UAH',
        fromCashbox: null,
        toCashbox: 'cb1',
        transactionDate: new Date('2025-01-01T00:00:00.000Z'),
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        status: 'active',
        isCancellation: false,
      },
    ] as unknown as FinanceTransactionDocument[];

    // reverse deposit: balance_at_end = current - deposit = 10 - 50 = -40
    const balances = computeBalancesAtPeriodEnd(cashboxes, txs);
    expect(balances).toEqual([{ cashboxId: 'cb1', currency: 'UAH', amount: -40 }]);
  });
});
