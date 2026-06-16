import { describe, expect, it } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import { validateFinanceTransactionPayload } from './validators';

const expectBadRequest = (operation: () => unknown, message: string) => {
  try {
    operation();
    throw new Error('Expected validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).statusCode).toBe(400);
    expect((error as Error).message).toBe(message);
  }
};

describe('validateFinanceTransactionPayload', () => {
  it('accepts valid deposit, withdraw, and transfer payloads', () => {
    expect(
      validateFinanceTransactionPayload({
        type: 'deposit',
        amount: '100.25',
        currency: 'UAH',
        toCashboxId: 'cashbox-to',
        note: '',
      }),
    ).toMatchObject({ type: 'deposit' });

    expect(
      validateFinanceTransactionPayload({
        type: 'withdraw',
        amount: 50,
        currency: 'USD',
        fromCashboxId: 'cashbox-from',
      }),
    ).toMatchObject({ type: 'withdraw' });

    expect(
      validateFinanceTransactionPayload({
        type: 'transfer',
        amount: '10',
        fromCashboxId: 'cashbox-from',
        toCashboxId: 'cashbox-to',
      }),
    ).toMatchObject({ type: 'transfer' });
  });

  it('rejects non-object bodies and unsupported transaction types', () => {
    expectBadRequest(
      () => validateFinanceTransactionPayload(null),
      'Finance transaction payload must be an object.',
    );
    expectBadRequest(
      () => validateFinanceTransactionPayload({ type: 'refund', amount: 10 }),
      'Unsupported transaction type.',
    );
  });

  it('rejects invalid amount and currency fields', () => {
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'deposit',
          amount: 0,
          toCashboxId: 'cashbox-to',
        }),
      'Transaction amount must be greater than 0.',
    );
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'deposit',
          amount: 10,
          currency: '12',
          toCashboxId: 'cashbox-to',
        }),
      'Currency code must be 3-6 latin letters.',
    );
  });

  it('requires cashbox ids according to transaction type', () => {
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'deposit',
          amount: 10,
        }),
      'toCashboxId is required for deposit.',
    );
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'withdraw',
          amount: 10,
        }),
      'fromCashboxId is required for withdraw.',
    );
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'transfer',
          amount: 10,
          fromCashboxId: 'cashbox-1',
        }),
      'toCashboxId is required for transfer.',
    );
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'transfer',
          amount: 10,
          fromCashboxId: 'cashbox-1',
          toCashboxId: 'cashbox-1',
        }),
      'Transfer cashboxes must be different.',
    );
  });

  it('rejects invalid optional metadata', () => {
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'deposit',
          amount: 10,
          toCashboxId: 'cashbox-to',
          transactionDate: 'not-a-date',
        }),
      'Invalid transaction date.',
    );
    expectBadRequest(
      () =>
        validateFinanceTransactionPayload({
          type: 'deposit',
          amount: 10,
          toCashboxId: 'cashbox-to',
          note: 42,
        }),
      'Transaction note must be a string.',
    );
  });
});
