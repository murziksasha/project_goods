import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  cashboxes: new Map<string, any>(),
  currencies: new Map<string, any>(),
  transactions: new Map<string, any>(),
  nextCashboxId: 10,
  nextCurrencyId: 50,
  nextTransactionId: 100,
}));

const leanResult = <T>(value: T) => ({
  lean: async () => value,
});

const matchesQuery = (cashbox: any, query: any) => {
  if (!query || Object.keys(query).length === 0) return true;
  if (query.isDefault !== undefined && cashbox.isDefault !== query.isDefault) {
    return false;
  }
  if (query.isArchived !== undefined && cashbox.isArchived !== query.isArchived) {
    return false;
  }
  if (query.name !== undefined && cashbox.name !== query.name) {
    return false;
  }
  return true;
};

vi.mock('./model', () => {
  class FinanceCurrencyConfigMock {
    static findOne(query: any) {
      return leanResult(store.currencies.get(String(query.code)) ?? null);
    }

    static findOneAndUpdate(query: any, update: any) {
      const code = String(query.code);
      let currency = store.currencies.get(code);
      if (!currency) {
        currency = {
          _id: String(store.nextCurrencyId++).padStart(24, '0'),
          code,
          isSystem: false,
          isArchived: false,
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          updatedAt: new Date('2026-06-01T10:00:00.000Z'),
          ...(update.$setOnInsert ?? {}),
        };
        store.currencies.set(code, currency);
      }
      Object.assign(currency, update.$set ?? {});
      return leanResult(currency);
    }

    static find(query: any) {
      const results = [...store.currencies.values()].filter(
        (currency) => query.isArchived === undefined || currency.isArchived === query.isArchived,
      );
      return {
        sort: () => ({
          lean: async () => results,
        }),
      };
    }
  }

  class CashboxMock {
    _id: string;
    name: string;
    balances: Record<string, number>;
    enabledCurrencies?: Record<string, boolean>;
    isDefault: boolean;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;

    constructor(payload: any) {
      this._id = String(store.nextCashboxId++).padStart(24, '0');
      this.name = payload.name;
      this.balances = payload.balances ?? { UAH: 0, USD: 0 };
      this.enabledCurrencies = payload.enabledCurrencies;
      this.isDefault = payload.isDefault ?? false;
      this.isArchived = payload.isArchived ?? false;
      this.createdAt = new Date('2026-06-01T10:00:00.000Z');
      this.updatedAt = new Date('2026-06-01T10:00:00.000Z');
    }

    static findOne(query: any) {
      return leanResult([...store.cashboxes.values()].find((cashbox) => matchesQuery(cashbox, query)) ?? null);
    }

    static findOneAndUpdate(query: any, update: any) {
      let cashbox = [...store.cashboxes.values()].find((item) => matchesQuery(item, query));
      if (!cashbox) {
        cashbox = {
          _id: String(store.nextCashboxId++).padStart(24, '0'),
          ...(update.$setOnInsert ?? {}),
          isDefault: false,
          isArchived: false,
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          updatedAt: new Date('2026-06-01T10:00:00.000Z'),
        };
        store.cashboxes.set(cashbox._id, cashbox);
      }
      Object.entries(update.$set ?? {}).forEach(([path, value]) => {
        if (path.includes('.')) {
          const [root, key] = path.split('.');
          cashbox[root] = { ...(cashbox[root] ?? {}), [key]: value };
        } else {
          cashbox[path] = value;
        }
      });
      return leanResult(cashbox);
    }

    static async updateMany(query: any, update: any) {
      [...store.cashboxes.values()].forEach((cashbox) => {
        if (
          query.enabledCurrencies?.$exists === false &&
          cashbox.enabledCurrencies !== undefined
        ) {
          return;
        }
        if (
          query['enabledCurrencies.UAH']?.$ne === true &&
          cashbox.enabledCurrencies?.UAH === true
        ) {
          return;
        }
        if (
          query['enabledCurrencies.USD']?.$exists === false &&
          cashbox.enabledCurrencies?.USD !== undefined
        ) {
          return;
        }
        Object.entries(update.$set ?? {}).forEach(([path, value]) => {
          if (!path.includes('.')) {
            cashbox[path] = value;
            return;
          }
          const [root, key] = path.split('.');
          cashbox[root] = { ...(cashbox[root] ?? {}), [key]: value };
        });
      });
    }

    static find(query: any) {
      const results = [...store.cashboxes.values()].filter((cashbox) =>
        matchesQuery(cashbox, query),
      );
      return {
        sort: () => ({
          lean: async () => results,
        }),
      };
    }

    static findById(id: string) {
      return leanResult(store.cashboxes.get(String(id)) ?? null);
    }

    static findByIdAndUpdate(id: string, update: any) {
      const cashbox = store.cashboxes.get(String(id));
      if (!cashbox) return leanResult(null);
      Object.entries(update.$set ?? {}).forEach(([path, value]) => {
        if (path.includes('.')) {
          const [root, key] = path.split('.');
          cashbox[root] = { ...(cashbox[root] ?? {}), [key]: value };
        } else {
          cashbox[path] = value;
        }
      });
      Object.entries(update.$inc ?? {}).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + Number(delta);
      });
      return leanResult(cashbox);
    }

    static updateOne(query: any, update: any) {
      const cashbox = store.cashboxes.get(String(query._id));
      if (!cashbox) return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
      const balanceCondition = Object.entries(query).find(([key]) =>
        key.startsWith('balances.'),
      );
      if (balanceCondition) {
        const [path, condition] = balanceCondition;
        const currency = path.replace('balances.', '');
        const minimum = (condition as { $gte?: number }).$gte ?? 0;
        if ((cashbox.balances[currency] ?? 0) < minimum) {
          return Promise.resolve({ matchedCount: 0, modifiedCount: 0 });
        }
      }
      Object.entries(update.$inc ?? {}).forEach(([path, delta]) => {
        const currency = path.replace('balances.', '');
        cashbox.balances[currency] = (cashbox.balances[currency] ?? 0) + Number(delta);
      });
      return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
    }

    async validate() {
      return undefined;
    }

    async save() {
      store.cashboxes.set(this._id, this);
    }

    toObject() {
      return this;
    }
  }

  class FinanceTransactionMock {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: any;

    constructor(payload: any) {
      Object.assign(this, payload);
      this._id = String(store.nextTransactionId++).padStart(24, '0');
      this.createdAt = new Date('2026-06-01T10:00:00.000Z');
      this.updatedAt = new Date('2026-06-01T10:00:00.000Z');
    }

    static findOne(query: any) {
      if (query && typeof query.idempotencyKey !== 'undefined') {
        const key = String(query.idempotencyKey ?? '').trim();
        if (!key) {
          return leanResult(null);
        }
        const transaction = [...store.transactions.values()].find(
          (item) => item.idempotencyKey && String(item.idempotencyKey).trim() === key,
        );
        return leanResult(transaction ?? null);
      }
      // unsupported query shape for this mock; return null to avoid false matches
      return leanResult(null);
    }

    async validate() {
      return undefined;
    }

    async save() {
      const key = this.idempotencyKey ? String(this.idempotencyKey).trim() : '';
      if (key) {
        const existing = [...store.transactions.values()].find(
          (item) =>
            item.idempotencyKey &&
            String(item.idempotencyKey).trim() === key &&
            item._id !== this._id,
        );
        if (existing) {
          const err: any = new Error('E11000 duplicate key error collection');
          err.code = 11000;
          throw err;
        }
      }
      store.transactions.set(this._id, this);
    }

    toObject() {
      return this;
    }
  }

  return {
    Cashbox: CashboxMock,
    FinanceCurrencyConfig: FinanceCurrencyConfigMock,
    FinanceTransaction: FinanceTransactionMock,
    baseFinanceCurrency: 'UAH',
    seededFinanceCurrencies: ['UAH', 'USD'],
    transactionTypes: ['deposit', 'withdraw', 'transfer'],
  };
});

const {
  createFinanceCurrency,
  createCashbox,
  createFinanceTransaction,
  listCashboxes,
  listFinanceCurrencies,
  updateCashbox,
} = await import('./service');

const defaultCashboxId = '111111111111111111111111';
const reserveCashboxId = '222222222222222222222222';

const seedCashbox = (id: string, patch: Record<string, unknown> = {}) => {
  store.cashboxes.set(id, {
    _id: id,
    name: `Cashbox ${id}`,
    balances: { UAH: 0, USD: 0 },
    enabledCurrencies: { UAH: true, USD: false },
    isDefault: id === defaultCashboxId,
    isArchived: false,
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    ...patch,
  });
};

describe('cashbox currency settings', () => {
  beforeEach(() => {
    store.cashboxes.clear();
    store.currencies.clear();
    store.transactions.clear();
    store.nextCashboxId = 10;
    store.nextCurrencyId = 50;
    store.nextTransactionId = 100;
    seedCashbox(defaultCashboxId);
    seedCashbox(reserveCashboxId);
  });

  it('creates cashboxes with USD disabled by default', async () => {
    const cashbox = await createCashbox({ name: 'New cashbox' });

    expect(cashbox.enabledCurrencies).toEqual({ UAH: true, USD: false });
  });

  it('backfills legacy cashboxes with USD disabled', async () => {
    store.cashboxes.get(defaultCashboxId).enabledCurrencies = undefined;

    const cashboxes = await listCashboxes();

    expect(cashboxes[0].enabledCurrencies).toEqual({ UAH: true, USD: false });
    expect(store.cashboxes.get(defaultCashboxId).enabledCurrencies).toEqual({
      UAH: true,
      USD: false,
    });
  });

  it('updates USD activity and rejects disabling UAH', async () => {
    const updated = await updateCashbox(defaultCashboxId, {
      enabledCurrencies: { UAH: true, USD: true },
    });

    expect(updated.enabledCurrencies).toEqual({ UAH: true, USD: true });
    await expect(
      updateCashbox(defaultCashboxId, {
        enabledCurrencies: { UAH: false, USD: true },
      }),
    ).rejects.toThrow('UAH currency cannot be disabled.');
  });

  it('rejects USD deposits into disabled cashboxes without changing balances', async () => {
    await expect(
      createFinanceTransaction({
        type: 'deposit',
        amount: '10',
        currency: 'USD',
        toCashboxId: defaultCashboxId,
      }),
    ).rejects.toThrow('Cashbox currency is not enabled for receiving.');

    expect(store.cashboxes.get(defaultCashboxId).balances.USD).toBe(0);
  });

  it('allows withdrawing existing USD from a disabled cashbox', async () => {
    store.cashboxes.get(defaultCashboxId).balances.USD = 25;

    const transaction = await createFinanceTransaction({
      type: 'withdraw',
      amount: '10',
      currency: 'USD',
      fromCashboxId: defaultCashboxId,
    });

    expect(transaction.currency).toBe('USD');
    expect(store.cashboxes.get(defaultCashboxId).balances.USD).toBe(15);
  });

  it('rejects USD transfers into disabled destination cashboxes', async () => {
    store.cashboxes.get(defaultCashboxId).balances.USD = 25;
    store.cashboxes.get(defaultCashboxId).enabledCurrencies.USD = true;

    await expect(
      createFinanceTransaction({
        type: 'transfer',
        amount: '10',
        currency: 'USD',
        fromCashboxId: defaultCashboxId,
        toCashboxId: reserveCashboxId,
      }),
    ).rejects.toThrow('Cashbox currency is not enabled for receiving.');

    expect(store.cashboxes.get(defaultCashboxId).balances.USD).toBe(25);
    expect(store.cashboxes.get(reserveCashboxId).balances.USD).toBe(0);
  });

  it('creates custom currencies as transaction currencies disabled in cashboxes by default', async () => {
    const currency = await createFinanceCurrency({ code: ' eur ' });
    const currencies = await listFinanceCurrencies({ includeArchived: true });

    expect(currency).toMatchObject({ code: 'EUR', isArchived: false });
    expect(currencies.map((item) => item.code)).toContain('EUR');
    expect(store.cashboxes.get(defaultCashboxId).balances.EUR).toBe(0);
    expect(store.cashboxes.get(defaultCashboxId).enabledCurrencies.EUR).toBe(false);
  });

  it('uses custom currencies with the same receive and withdraw-only rules', async () => {
    await createFinanceCurrency({ code: 'EUR' });

    await expect(
      createFinanceTransaction({
        type: 'deposit',
        amount: '10',
        currency: 'EUR',
        toCashboxId: defaultCashboxId,
      }),
    ).rejects.toThrow('Cashbox currency is not enabled for receiving.');

    await updateCashbox(defaultCashboxId, {
      enabledCurrencies: { UAH: true, EUR: true },
    });
    await createFinanceTransaction({
      type: 'deposit',
      amount: '10',
      currency: 'EUR',
      toCashboxId: defaultCashboxId,
    });
    expect(store.cashboxes.get(defaultCashboxId).balances.EUR).toBe(10);

    await updateCashbox(defaultCashboxId, {
      enabledCurrencies: { UAH: true, EUR: false },
    });
    await createFinanceTransaction({
      type: 'withdraw',
      amount: '5',
      currency: 'EUR',
      fromCashboxId: defaultCashboxId,
    });
    expect(store.cashboxes.get(defaultCashboxId).balances.EUR).toBe(5);
  });

  it('prevents concurrent withdrawals from overdrawing the same cashbox', async () => {
    store.cashboxes.get(defaultCashboxId).balances.UAH = 10;

    const results = await Promise.allSettled([
      createFinanceTransaction({
        type: 'withdraw',
        amount: '10',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
      }),
      createFinanceTransaction({
        type: 'withdraw',
        amount: '10',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(store.cashboxes.get(defaultCashboxId).balances.UAH).toBe(0);
  });

  it('double submit with identical idempotencyKey returns the same transaction and deducts only once', async () => {
    store.cashboxes.get(defaultCashboxId).balances.UAH = 100;

    const key = 'idem-key-concurrent-xyz';
    const results = await Promise.allSettled([
      createFinanceTransaction({
        type: 'withdraw',
        amount: '30',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
        idempotencyKey: key,
      }),
      createFinanceTransaction({
        type: 'withdraw',
        amount: '30',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
        idempotencyKey: key,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(2);
    const txIds = fulfilled.map((r: any) => r.value?.id ?? r.value?._id).filter(Boolean);
    expect(new Set(txIds).size).toBe(1);
    expect(store.cashboxes.get(defaultCashboxId).balances.UAH).toBe(70);
    expect(store.transactions.size).toBe(1);
  });

  it('concurrent transfers from same cashbox do not overdraw (only one succeeds)', async () => {
    store.cashboxes.get(defaultCashboxId).balances.UAH = 50;
    seedCashbox(reserveCashboxId); // ensure target exists

    const results = await Promise.allSettled([
      createFinanceTransaction({
        type: 'transfer',
        amount: '40',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
        toCashboxId: reserveCashboxId,
      }),
      createFinanceTransaction({
        type: 'transfer',
        amount: '40',
        currency: 'UAH',
        fromCashboxId: defaultCashboxId,
        toCashboxId: reserveCashboxId,
      }),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(fail).toBe(1);
    expect(store.cashboxes.get(defaultCashboxId).balances.UAH).toBe(10);
  });
});
