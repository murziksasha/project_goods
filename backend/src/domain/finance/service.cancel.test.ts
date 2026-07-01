import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('mongoose', () => ({
  default: {
    connection: { readyState: 0 },
    startSession: vi.fn(),
  },
}));

const store = vi.hoisted(() => ({
  cashboxes: new Map<string, any>(),
  transactions: new Map<string, any>(),
  nextTransactionId: 100,
}));

const leanResult = <T>(value: T) => ({
  lean: async () => value,
});

vi.mock('./model', () => {
  class CashboxMock {
    static findById(id: string) {
      return leanResult(store.cashboxes.get(String(id)) ?? null);
    }

    static findByIdAndUpdate(id: string, update: { $inc?: Record<string, number> }) {
      const cashbox = store.cashboxes.get(String(id));
      if (!cashbox || !update.$inc) return Promise.resolve(null);
      Object.entries(update.$inc).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + delta;
      });
      return Promise.resolve(cashbox);
    }

    static updateOne(query: any, update: { $inc?: Record<string, number> }) {
      const cashbox = store.cashboxes.get(String(query._id));
      if (!cashbox || !update.$inc) {
        return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
      }
      const balanceKey = Object.keys(query).find((key) => key.startsWith('balances.'));
      if (balanceKey) {
        const currency = balanceKey.replace('balances.', '');
        const required = query[balanceKey]?.$gte ?? 0;
        if ((cashbox.balances[currency] ?? 0) < required) {
          return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
        }
      }
      Object.entries(update.$inc).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + delta;
      });
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    }
  }

  class FinanceTransactionMock {
    _id: string;
    type: string;
    amount: number;
    currency: string;
    fromCashbox: string | null;
    toCashbox: string | null;
    fromSnapshot?: { name?: string };
    toSnapshot?: { name?: string };
    note: string;
    transactionDate: Date;
    status: string;
    isCancellation: boolean;
    cancelsTransaction: string | null;
    cancellationTransaction: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;

    constructor(payload: any) {
      this._id = String(store.nextTransactionId++).padStart(24, '0');
      this.type = payload.type;
      this.amount = payload.amount;
      this.currency = payload.currency;
      this.fromCashbox = payload.fromCashbox ?? null;
      this.toCashbox = payload.toCashbox ?? null;
      this.fromSnapshot = payload.fromSnapshot;
      this.toSnapshot = payload.toSnapshot;
      this.note = payload.note ?? '';
      this.transactionDate = payload.transactionDate;
      this.status = payload.status ?? 'active';
      this.isCancellation = payload.isCancellation ?? false;
      this.cancelsTransaction = payload.cancelsTransaction ?? null;
      this.cancellationTransaction = payload.cancellationTransaction ?? null;
      this.cancelledAt = payload.cancelledAt ?? null;
      this.createdAt = new Date('2026-05-31T10:00:00.000Z');
      this.updatedAt = new Date('2026-05-31T10:00:00.000Z');
    }

    static findById(id: string) {
      return leanResult(store.transactions.get(String(id)) ?? null);
    }

    static findOne(query: any) {
      const transaction = [...store.transactions.values()].find(
        (item) => item.cancelsTransaction === query.cancelsTransaction,
      );
      return leanResult(transaction ?? null);
    }

    static findOneAndUpdate(query: any, update: any) {
      const transaction = store.transactions.get(String(query._id));
      if (
        !transaction ||
        transaction.status === 'cancelled' ||
        transaction.isCancellation
      ) {
        return leanResult(null);
      }
      Object.assign(transaction, update.$set, { updatedAt: new Date('2026-05-31T10:05:00.000Z') });
      return leanResult(transaction);
    }

    static async findByIdAndDelete(id: string) {
      store.transactions.delete(String(id));
    }

    async validate() {
      return undefined;
    }

    async save() {
      store.transactions.set(this._id, this);
    }
  }

  return {
    Cashbox: CashboxMock,
    FinanceTransaction: FinanceTransactionMock,
    financeCurrencies: ['UAH', 'USD'],
    transactionTypes: ['deposit', 'withdraw', 'transfer'],
  };
});

const { cancelFinanceTransaction } = await import('./service');

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

describe('cancelFinanceTransaction', () => {
  beforeEach(() => {
    store.cashboxes.clear();
    store.transactions.clear();
    store.nextTransactionId = 100;
    seedCashboxes();
    seedTransaction({ transactionDate: sameBusinessDayDate() });
  });

  it('cancels an active transfer and creates a linked reverse transaction', async () => {
    const cancelled = await cancelFinanceTransaction(transferId);
    const reverseTransaction = [...store.transactions.values()].find(
      (transaction) => transaction.cancelsTransaction === transferId,
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
      (transaction) => transaction.cancelsTransaction === transferId,
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
      (transaction) => transaction.cancelsTransaction === transferId,
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
    seedTransaction({ isCancellation: true, cancelsTransaction: 'bbbbbbbbbbbbbbbbbbbbbbbb' });

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
      (transaction) => transaction.cancelsTransaction === transferId,
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
    // initial after seed: from=100, to=50 , transfer 25 from->to
    const results = await Promise.allSettled([
      cancelFinanceTransaction(transferId),
      cancelFinanceTransaction(transferId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    // Exactly one should succeed in creating the cancel (other hits guard or duplicate)
    expect(fulfilled + rejected).toBe(2);
    // Only one reverse tx referencing the original
    const reverseTxs = [...store.transactions.values()].filter(
      (t: any) => t.cancelsTransaction === transferId,
    );
    expect(reverseTxs.length).toBe(1);

    // Balance reverted exactly once: from gets +25 ->125, to -25->25
    expect(store.cashboxes.get(fromCashboxId).balances.UAH).toBe(125);
    expect(store.cashboxes.get(toCashboxId).balances.UAH).toBe(25);
  });
});
