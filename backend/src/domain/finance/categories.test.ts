import { describe, expect, it } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import {
  inferFinanceTransactionCategory,
  normalizeOptionalCategory,
  resolveFinanceTransactionCategory,
} from './categories';

describe('finance transaction categories', () => {
  it('infers client payments from deposit notes and supplier payments from matching withdraw notes', () => {
    expect(
      inferFinanceTransactionCategory('deposit', 'Payment for order r000008'),
    ).toBe('client_payment');
    expect(
      inferFinanceTransactionCategory('deposit', 'Оплата за замовлення r000008'),
    ).toBe('client_payment');
    expect(inferFinanceTransactionCategory('deposit', 'Owner cash-in')).toBe(
      'other',
    );
    expect(
      inferFinanceTransactionCategory('withdraw', 'Supplier order payment: SO-1'),
    ).toBe('supplier_payment');
    expect(
      inferFinanceTransactionCategory('withdraw', 'Payment for order SO-1'),
    ).toBe('supplier_payment');
    expect(
      inferFinanceTransactionCategory('withdraw', 'Refund for order r000008'),
    ).toBe('client_refund');
    expect(
      inferFinanceTransactionCategory(
        'withdraw',
        'Serial return for sale r000008: Screen',
      ),
    ).toBe('client_refund');
    expect(inferFinanceTransactionCategory('withdraw', 'Rent May')).toBe('other');
    expect(inferFinanceTransactionCategory('transfer', 'Move')).toBeUndefined();
  });

  it('prefers an explicit category and rejects unknown values', () => {
    expect(
      resolveFinanceTransactionCategory('withdraw', 'Rent May', 'rent'),
    ).toBe('rent');
    expect(resolveFinanceTransactionCategory('transfer', 'Move', 'rent')).toBe(
      undefined,
    );
    expect(normalizeOptionalCategory(undefined)).toBeUndefined();
    expect(normalizeOptionalCategory('')).toBeUndefined();
    expect(normalizeOptionalCategory('salary')).toBe('salary');
    try {
      normalizeOptionalCategory('bonus');
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(400);
    }
  });
});
