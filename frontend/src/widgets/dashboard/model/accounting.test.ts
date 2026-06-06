import { describe, expect, it } from 'vitest';
import type {
  Cashbox,
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import {
  filterFinanceTransactions,
  getAccountingTotals,
  getActiveTransactionFiltersCount,
  getBalanceAfterByTransactionId,
  getFinanceOverview,
  initialTransactionFilters,
  normalizeCashboxCurrencyActivity,
  normalizeCurrencyActivity,
} from './accounting';

const createCashbox = (
  id: string,
  balances: Record<string, number>,
  isArchived = false,
): Cashbox => ({
  id,
  name: `Cashbox ${id}`,
  balances,
  isDefault: id === 'cash-1',
  isArchived,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const createTransaction = (
  patch: Partial<FinanceTransaction>,
): FinanceTransaction => ({
  id: patch.id ?? 'tx-1',
  type: patch.type ?? 'deposit',
  amount: patch.amount ?? 100,
  currency: patch.currency ?? 'UAH',
  fromCashbox: patch.fromCashbox ?? null,
  toCashbox: patch.toCashbox ?? { id: 'cash-1', name: 'Cashbox cash-1' },
  note: patch.note ?? '',
  transactionDate: patch.transactionDate ?? '2026-01-01T10:00:00.000Z',
  status: patch.status ?? 'active',
  isCancellation: patch.isCancellation ?? false,
  cancelsTransactionId: patch.cancelsTransactionId,
  cancellationTransactionId: patch.cancellationTransactionId,
  cancelledAt: patch.cancelledAt,
  createdAt: patch.createdAt ?? '2026-01-01T10:00:00.000Z',
  updatedAt: patch.updatedAt ?? '2026-01-01T10:00:00.000Z',
});

describe('accounting model helpers', () => {
  it('summarizes cashbox totals and finance overview rows', () => {
    const cashboxes = [
      createCashbox('cash-1', { UAH: 100, USD: 5 }),
      createCashbox('cash-2', { UAH: 50, USD: 0 }),
    ];
    const archivedCashbox = createCashbox('cash-3', { UAH: 0, USD: 0 }, true);
    const supplierOrdersQueue: SupplierOrderPaymentQueueItem[] = [
      {
        id: 'order-1',
        orderBaseId: 'base-1',
        number: 'PO-1',
        supplierName: 'Supplier',
        deliveryDate: '',
        total: 75,
        createdAt: '2026-01-01',
      },
    ];

    expect(getAccountingTotals(cashboxes)).toEqual({ UAH: 150, USD: 5 });

    const overview = getFinanceOverview({
      allCashboxes: [...cashboxes, archivedCashbox],
      allCurrencyCodes: ['UAH', 'USD'],
      cashboxes,
      getCurrencyBalance: (cashbox, currency) => cashbox.balances[currency] ?? 0,
      isGlobalCurrencyActive: () => true,
      report: null,
      supplierOrdersQueue,
      transactions: [createTransaction({ id: 'tx-1', amount: 25 })],
    });

    expect(overview.pendingSupplierTotal).toBe(75);
    expect(overview.activeCashboxCount).toBe(2);
    expect(overview.archivedCashboxCount).toBe(1);
    expect(overview.currencyRows.find((row) => row.currency === 'UAH')?.total).toBe(150);
  });

  it('calculates balance after each transaction from current balances', () => {
    const cashboxes = [createCashbox('cash-1', { UAH: 120, USD: 0 })];
    const transactions = [
      createTransaction({
        id: 'latest-deposit',
        type: 'deposit',
        amount: 20,
        toCashbox: { id: 'cash-1', name: 'Main' },
        transactionDate: '2026-01-02T10:00:00.000Z',
      }),
      createTransaction({
        id: 'older-withdraw',
        type: 'withdraw',
        amount: 30,
        fromCashbox: { id: 'cash-1', name: 'Main' },
        toCashbox: null,
        transactionDate: '2026-01-01T10:00:00.000Z',
      }),
    ];

    expect(getBalanceAfterByTransactionId({ cashboxes, transactions })).toEqual({
      'latest-deposit': 120,
      'older-withdraw': 100,
    });
  });

  it('filters, sorts, and counts active transaction filters', () => {
    const matching = createTransaction({
      id: 'matching',
      type: 'withdraw',
      amount: 40,
      fromCashbox: { id: 'cash-1', name: 'Main' },
      toCashbox: null,
      note: 'Payment for order SO-1',
      transactionDate: '2026-01-03T10:00:00.000Z',
    });
    const other = createTransaction({
      id: 'other',
      type: 'deposit',
      amount: 10,
      note: 'Other',
      transactionDate: '2026-01-01T10:00:00.000Z',
    });
    const filters = {
      ...initialTransactionFilters,
      type: 'withdraw' as const,
      note: 'order',
      sortBy: 'amount' as const,
      sortDirection: 'asc' as const,
    };

    expect(
      filterFinanceTransactions({
        filters,
        selectedCashboxId: 'cash-1',
        transactions: [other, matching],
      }),
    ).toEqual([matching]);
    expect(getActiveTransactionFiltersCount(filters)).toBe(2);
  });

  it('normalizes currency activity maps without dropping required defaults', () => {
    expect(normalizeCurrencyActivity({ USD: false }, ['UAH', 'USD'])).toEqual({
      UAH: true,
      USD: false,
    });
    expect(
      normalizeCashboxCurrencyActivity({
        allCashboxes: [createCashbox('cash-1', { UAH: 0, USD: 0 })],
        allCurrencyCodes: ['UAH', 'USD'],
        current: { 'cash-1': { USD: false } },
      }),
    ).toEqual({
      'cash-1': {
        UAH: true,
        USD: false,
      },
    });
  });
});
