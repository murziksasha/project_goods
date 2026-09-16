import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import {
  inferFinanceTransactionCategory,
  normalizeOptionalCategory,
  resolveFinanceTransactionCategory,
} from './categories';
import { FinanceCategory } from './model';

describe('finance transaction categories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('prefers an explicit category and rejects unknown values', async () => {
    await expect(
      resolveFinanceTransactionCategory('withdraw', 'Rent May', 'rent'),
    ).resolves.toBe('rent');
    await expect(
      resolveFinanceTransactionCategory('transfer', 'Move', 'rent'),
    ).resolves.toBeUndefined();
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

  it('rejects inactive opex categories for new withdraws', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 1,
    });
    vi.spyOn(FinanceCategory, 'findOne').mockReturnValue({
      lean: async () => ({
        slug: 'rent',
        kind: 'system_opex',
        isActive: false,
        isSystem: true,
        name: 'Rent',
        sortOrder: 110,
      }),
    } as never);

    await expect(
      resolveFinanceTransactionCategory('withdraw', 'Rent May', 'rent'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Inactive finance transaction category.',
    });

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 0,
    });
  });
});
