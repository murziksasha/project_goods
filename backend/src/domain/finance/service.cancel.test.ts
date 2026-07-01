import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Cashbox, FinanceTransaction } from './model';
import { cancelFinanceTransaction } from './service';

const store = vi.hoisted(() => ({
  cashboxes: new Map<string, any>(),
  transactions: new Map<string, any>(),
  nextTransactionId: 100,
}));

const leanResult = <T>(value: T) => ({
  lean: vi.fn(async () => value),
});

const fromCashboxId = '111111111111111111111111';
const toCashboxId = '222222222222222222222222';
const transferId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const sameBusinessDayDate = () => new Date();

const seedCashboxes = () => {
  store.cashboxes.set(fromCashboxId, {
    _id: fromCashboxId,
    name: 'Main cashbox',
    balances: { UAH: 100, USD: 0 },
    isDefault: true,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.cashboxes.set(toCashboxId, {
    _id: toCashboxId,
    name: 'Reserve cashbox',
    balances: { UAH: 50, USD: 0 },
    isDefault: false,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

const seedTransaction = (patch: Record<string, unknown> = {}) => {
  store.transactions.set(transferId, {
    _id: transferId,
    type: 'transfer',
    amount: 25,
    currency: 'UAH',
    fromCashbox: fromCashboxId,
    toCashbox: toCashboxId,
    fromSnapshot: { name: 'Main cashbox' },
    toSnapshot: { name: 'Reserve cashbox' },
    note: 'Manual transfer',
    transactionDate: sameBusinessDayDate(),
    status: 'active',
    isCancellation: false,
    cancelsTransaction: null,
    cancellationTransaction: null,
    cancelledAt: null,
    createdAt: new Date('2026-05-31T09:00:00.000Z'),
    updatedAt: new Date('2026-05-31T09:00:00.000Z'),
    ...patch,
  });
};

const installFinanceModelSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(Cashbox, 'findById').mockImplementation(
    (id: unknown) =>
      leanResult(store.cashboxes.get(String(id)) ?? null) as never,
  );

  vi.spyOn(Cashbox, 'findByIdAndUpdate').mockImplementation(
    (id: unknown, update: { $inc?: Record<string, number> }) => {
      const cashbox = store.cashboxes.get(String(id));
      if (!cashbox || !update.$inc) {
        return Promise.resolve(null) as never;
      }
      Object.entries(update.$inc).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + delta;
      });
      return Promise.resolve(cashbox) as never;
    },
  );

  vi.spyOn(Cashbox, 'updateOne').mockImplementation((query: any, update: any) => {
    const cashbox = store.cashboxes.get(String(query._id));
    if (!cashbox || !update.$inc) {
      return Promise.resolve({ matchedCount: 0, modifiedCount: 0 }) as never;
    }
    const balanceKey = Object.keys(query).find((key) =>
      key.startsWith('balances.'),
    );
    if (balanceKey) {
      const currency = balanceKey.replace('balances.', '');
      const required = query[balanceKey]?.$gte ?? 0;
      if ((cashbox.balances[currency] ?? 0) < required) {
        return Promise.resolve({ matchedCount: 0, modifiedCount: 0 }) as never;
      }
    }
    Object.entries(update.$inc).forEach(([path, delta]) => {
      const currency = path.replace('balances.', '');
      cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + delta;
    });
    return Promise.resolve({ matchedCount: 1, modifiedCount: 1 }) as never;
  });

  vi.spyOn(FinanceTransaction, 'findById').mockImplementation(
    (id: unknown) =>
      leanResult(store.transactions.get(String(id)) ?? null) as never,
  );

  vi.spyOn(FinanceTransaction, 'findOne').mockImplementation((query: any) => {
    const target = String(query.cancelsTransaction ?? '');
    const transaction = [...store.transactions.values()].find(
      (item) => String(item.cancelsTransaction ?? '') === target,
    );
    return leanResult(transaction ?? null) as never;
  });

  vi.spyOn(FinanceTransaction, 'findOneAndUpdate').mockImplementation(
    (query: any, update: any) => {
      const transaction = store.transactions.get(String(query._id));
      if (
        !transaction ||
        transaction.status === 'cancelled' ||
        transaction.isCancellation
      ) {
        return leanResult(null) as never;
      }
      Object.assign(transaction, update.$set, {
        updatedAt: new Date('2026-05-31T10:05:00.000Z'),
      });
      return leanResult(transaction) as never;
    },
  );

  vi.spyOn(FinanceTransaction, 'findByIdAndDelete').mockImplementation(
    async (id: unknown) => {
      store.transactions.delete(String(id));
      return null as never;
    },
  );

  vi.spyOn(FinanceTransaction.prototype, 'validate').mockResolvedValue(
    undefined as never,
  );
  vi.spyOn(FinanceTransaction.prototype, 'save').mockImplementation(
    async function saveCancellation(this: any) {
      const id = String(store.nextTransactionId++).padStart(24, '0');
      const record = {
        _id: id,
        type: this.type,
        amount: this.amount,
        currency: this.currency,
        fromCashbox:
          this.fromCashbox != null ? String(this.fromCashbox) : null,
        toCashbox: this.toCashbox != null ? String(this.toCashbox) : null,
        fromSnapshot: this.fromSnapshot,
        toSnapshot: this.toSnapshot,
        note: this.note ?? '',
        transactionDate: this.transactionDate,
        status: this.status ?? 'active',
        isCancellation: this.isCancellation ?? false,
        cancelsTransaction:
          this.cancelsTransaction != null
            ? String(this.cancelsTransaction)
            : null,
        cancellationTransaction: this.cancellationTransaction ?? null,
        cancelledAt: this.cancelledAt ?? null,
        createdAt: new Date('2026-05-31T10:00:00.000Z'),
        updatedAt: new Date('2026-05-31T10:00:00.000Z'),
      };
      store.transactions.set(id, record);
      this._id = id;
      return this;
    },
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  store.cashboxes.clear();
  store.transactions.clear();
  store.nextTransactionId = 100;
  seedCashboxes();
  seedTransaction({ transactionDate: sameBusinessDayDate() });
  installFinanceModelSpies();
});

describe('cancelFinanceTransaction', () => {
  it('cancels an active transfer and creates a linked reverse transaction', async () => {
    const cancelled = await cancelFinanceTransaction(transferId);
    const reverseTransaction = [...store.transactions.values()].find(
      (transaction) => String(transaction.cancelsTransaction) === transferId,
    );

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationTransactionId).toBe(reverseTransaction?._id);
    expect(reverseTransaction).toMatchObject({
      type: 'transfer',
      amount: 25,
      currency: 'UAH',
      fromCashbox: toCashboxId,
      toCashbox: fromCashboxId,
      isCancellation: true,
      cancelsTransaction: transferId,
    });
    expect(store.cashboxes.get(fromCashboxId).balances.UAH).toBe(125);
    expect(store.cashboxes.get(toCashboxId).balances.UAH).toBe(25);
  });

  it('prevents double cancellation', async () => {
    await cancelFinanceTransaction(transferId);

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Transaction is already cancelled.',
    );
  });

  it('cancels an active deposit and creates a linked reverse withdraw', async () => {
    seedTransaction({
      type: 'deposit',
      fromCashbox: null,
      toCashbox: toCashboxId,
      fromSnapshot: undefined,
      toSnapshot: { name: 'Reserve cashbox' },
    });
    store.cashboxes.get(toCashboxId).balances.UAH = 75;

    const cancelled = await cancelFinanceTransaction(transferId);
    const reverseTransaction = [...store.transactions.values()].find(
      (transaction) => String(transaction.cancelsTransaction) === transferId,
    );

    expect(cancelled.status).toBe('cancelled');
    expect(reverseTransaction).toMatchObject({
      type: 'withdraw',
      amount: 25,
      currency: 'UAH',
      fromCashbox: toCashboxId,
      toCashbox: null,
      isCancellation: true,
      cancelsTransaction: transferId,
    });
    expect(store.cashboxes.get(toCashboxId).balances.UAH).toBe(50);
  });

  it('cancels an active withdraw and creates a linked reverse deposit', async () => {
    seedTransaction({
      type: 'withdraw',
      fromCashbox: fromCashboxId,
      toCashbox: null,
      fromSnapshot: { name: 'Main cashbox' },
      toSnapshot: undefined,
    });
    store.cashboxes.get(fromCashboxId).balances.UAH = 75;

    const cancelled = await cancelFinanceTransaction(transferId);
    const reverseTransaction = [...store.transactions.values()].find(
      (transaction) => String(transaction.cancelsTransaction) === transferId,
    );

    expect(cancelled.status).toBe('cancelled');
    expect(reverseTransaction).toMatchObject({
      type: 'deposit',
      amount: 25,
      currency: 'UAH',
      fromCashbox: null,
      toCashbox: fromCashboxId,
      isCancellation: true,
      cancelsTransaction: transferId,
    });
    expect(store.cashboxes.get(fromCashboxId).balances.UAH).toBe(100);
  });

  it.each([
    'Payment for order r000008',
    'Refund for order r000008',
    'Supplier order payment: SO-1',
  ])('rejects cancelling order-linked transaction note %s', async (note) => {
    seedTransaction({ note });

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Order-linked finance transactions cannot be cancelled.',
    );
  });

  it('rejects cancelling reversal transactions', async () => {
    seedTransaction({
      isCancellation: true,
      cancelsTransaction: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    });

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Cancellation transactions cannot be cancelled.',
    );
  });

  it('rejects cancelling transfers from a previous business day without changing balances', async () => {
    seedTransaction({ transactionDate: new Date('2020-01-01T09:00:00.000Z') });

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Transaction can be cancelled only during the transaction day.',
    );

    const reverseTransaction = [...store.transactions.values()].find(
      (transaction) => String(transaction.cancelsTransaction) === transferId,
    );
    expect(reverseTransaction).toBeUndefined();
    expect(store.transactions.get(transferId).status).toBe('active');
    expect(store.cashboxes.get(fromCashboxId).balances.UAH).toBe(100);
    expect(store.cashboxes.get(toCashboxId).balances.UAH).toBe(50);
  });

  it('rejects cancellation when the destination balance is insufficient', async () => {
    store.cashboxes.get(toCashboxId).balances.UAH = 10;

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Cashbox balance cannot become negative.',
    );
  });

  it('concurrent cancel attempts on same transfer produce only one cancellation and revert balance exactly once', async () => {
    const results = await Promise.allSettled([
      cancelFinanceTransaction(transferId),
      cancelFinanceTransaction(transferId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    expect(fulfilled + rejected).toBe(2);
    const reverseTxs = [...store.transactions.values()].filter(
      (t: any) => String(t.cancelsTransaction) === transferId,
    );
    expect(reverseTxs.length).toBe(1);
    expect(store.cashboxes.get(fromCashboxId).balances.UAH).toBe(125);
    expect(store.cashboxes.get(toCashboxId).balances.UAH).toBe(25);
  });
});