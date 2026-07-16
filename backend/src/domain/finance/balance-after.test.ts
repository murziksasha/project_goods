import { describe, expect, it } from 'vitest';
import { computeBalanceAfterByTransactionId } from './balance-after';
import type { FinanceTransactionDocument } from './model';

const tx = (
  patch: Partial<FinanceTransactionDocument> & { _id: string },
): FinanceTransactionDocument =>
  ({
    amount: 10,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    currency: 'UAH',
    fromCashbox: null,
    isCancellation: false,
    note: '',
    status: 'active',
    toCashbox: 'cash-1',
    transactionDate: new Date('2026-01-01T10:00:00.000Z'),
    type: 'deposit',
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...patch,
  }) as FinanceTransactionDocument;

describe('computeBalanceAfterByTransactionId', () => {
  it('rewinds balances from current cashbox totals', () => {
    const result = computeBalanceAfterByTransactionId({
      cashboxes: [{ id: 'cash-1', balances: { UAH: 120 } }],
      transactions: [
        tx({
          _id: 'latest',
          amount: 20,
          transactionDate: new Date('2026-01-02T10:00:00.000Z'),
          createdAt: new Date('2026-01-02T10:00:00.000Z'),
        }),
        tx({
          _id: 'older',
          amount: 30,
          type: 'withdraw',
          fromCashbox: 'cash-1',
          toCashbox: null,
          transactionDate: new Date('2026-01-01T10:00:00.000Z'),
        }),
      ],
    });

    expect(result).toEqual({
      latest: 120,
      older: 100,
    });
  });
});