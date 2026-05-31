import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    static async findByIdAndUpdate(id: string, update: { $inc?: Record<string, number> }) {
      const cashbox = store.cashboxes.get(String(id));
      if (!cashbox || !update.$inc) return null;
      Object.entries(update.$inc).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + delta;
      });
      return cashbox;
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
    transactionDate: new Date('2026-05-31T09:00:00.000Z'),
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
    seedTransaction();
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

  it.each(['deposit', 'withdraw'])('rejects cancelling %s transactions', async (type) => {
    seedTransaction({
      type,
      fromCashbox: type === 'withdraw' ? fromCashboxId : null,
      toCashbox: type === 'deposit' ? toCashboxId : null,
    });

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Only transfers between cashboxes can be cancelled.',
    );
  });

  it('rejects cancelling reversal transactions', async () => {
    seedTransaction({ isCancellation: true, cancelsTransaction: 'bbbbbbbbbbbbbbbbbbbbbbbb' });

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Cancellation transactions cannot be cancelled.',
    );
  });

  it('rejects cancellation when the destination balance is insufficient', async () => {
    store.cashboxes.get(toCashboxId).balances.UAH = 10;

    await expect(cancelFinanceTransaction(transferId)).rejects.toThrow(
      'Cashbox balance cannot become negative.',
    );
  });
});
