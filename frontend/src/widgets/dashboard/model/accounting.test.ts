import { describe, expect, it } from 'vitest';
import type {
  Cashbox,
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import {
  canCancelAccountingTransaction,
  canCancelAccountingTransferTransaction,
  canPerformTransferBetweenCashboxes,
  filterFinanceTransactions,
  getAccountingTotals,
  getAccountingCashboxCurrencyRows,
  getAllowedAccountingTransactionCurrencies,
  getActiveTransactionFiltersCount,
  getBalanceAfterByTransactionId,
  getFinanceOverview,
  initialTransactionFilters,
  normalizeCurrencyActivity,
  isAccountingOrderLinkedNote,
  parseTransactionOrderToken,
  resolveCashboxOperationForm,
  upsertLastOperationByCashbox,
} from './accounting';

const createCashbox = (
  id: string,
  balances: Record<string, number>,
  isArchived = false,
): Cashbox => ({
  id,
  name: `Cashbox ${id}`,
  balances,
  enabledCurrencies: { UAH: true, USD: false },
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
  });

  it('hides disabled empty USD balances and shows existing disabled USD as withdraw-only', () => {
    const emptyUsdCashbox = createCashbox('cash-1', { UAH: 100, USD: 0 });
    const fundedUsdCashbox = createCashbox('cash-2', { UAH: 50, USD: 7 });
    const getCurrencyBalance = (cashbox: Cashbox, currency: string) =>
      cashbox.balances[currency] ?? 0;
    const isCashboxCurrencyActive = (cashboxId: string, currency: string) => {
      const cashbox = [emptyUsdCashbox, fundedUsdCashbox].find(
        (item) => item.id === cashboxId,
      );
      return cashbox?.enabledCurrencies[currency] === true;
    };

    expect(
      getAccountingCashboxCurrencyRows({
        allCurrencyCodes: ['UAH', 'USD'],
        cashbox: emptyUsdCashbox,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive: () => true,
      }).map((row) => row.currency),
    ).toEqual(['UAH']);

    expect(
      getAccountingCashboxCurrencyRows({
        allCurrencyCodes: ['UAH', 'USD'],
        cashbox: fundedUsdCashbox,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive: () => true,
      }),
    ).toContainEqual({
      currency: 'USD',
      balance: 7,
      canAccept: false,
      canWithdraw: true,
    });
  });

  it('allows transaction currencies according to per-cashbox currency settings', () => {
    const source = {
      ...createCashbox('cash-1', { UAH: 100, USD: 20 }),
      enabledCurrencies: { UAH: true, USD: true } as Record<string, boolean>,
    };
    const disabledDestination = createCashbox('cash-2', { UAH: 0, USD: 0 });
    const enabledDestination = {
      ...createCashbox('cash-3', { UAH: 0, USD: 0 }),
      enabledCurrencies: { UAH: true, USD: true } as Record<string, boolean>,
    };
    const cashboxes = [source, disabledDestination, enabledDestination];
    const getCurrencyBalance = (cashbox: Cashbox, currency: string) =>
      cashbox.balances[currency] ?? 0;
    const isCashboxCurrencyActive = (cashboxId: string, currency: string) =>
      cashboxes.find((cashbox) => cashbox.id === cashboxId)?.enabledCurrencies[
        currency
      ] === true;

    expect(
      getAllowedAccountingTransactionCurrencies({
        allCurrencyCodes: ['UAH', 'USD'],
        cashboxes,
        fromCashboxId: source.id,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive: () => true,
        toCashboxId: disabledDestination.id,
        type: 'transfer',
      }),
    ).toEqual(['UAH']);

    expect(
      getAllowedAccountingTransactionCurrencies({
        allCurrencyCodes: ['UAH', 'USD'],
        cashboxes,
        fromCashboxId: source.id,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive: () => true,
        toCashboxId: enabledDestination.id,
        type: 'transfer',
      }),
    ).toEqual(['UAH', 'USD']);
  });

  it('allows cancelling an eligible transfer on the same business day', () => {
    const transfer = createTransaction({
      type: 'transfer',
      fromCashbox: { id: 'cash-1', name: 'Main' },
      toCashbox: { id: 'cash-2', name: 'Reserve' },
      transactionDate: '2026-05-31T08:00:00.000Z',
    });

    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: true,
        now: new Date('2026-05-31T20:59:00.000Z'),
        transaction: transfer,
      }),
    ).toBe(true);
  });

  it('hides cancellation for transfers from a previous business day', () => {
    const transfer = createTransaction({
      type: 'transfer',
      fromCashbox: { id: 'cash-1', name: 'Main' },
      toCashbox: { id: 'cash-2', name: 'Reserve' },
      transactionDate: '2026-05-30T08:00:00.000Z',
    });

    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: true,
        now: new Date('2026-05-31T08:00:00.000Z'),
        transaction: transfer,
      }),
    ).toBe(false);
  });

  it('rejects cancellation for ineligible transaction states', () => {
    const transfer = createTransaction({
      type: 'transfer',
      fromCashbox: { id: 'cash-1', name: 'Main' },
      toCashbox: { id: 'cash-2', name: 'Reserve' },
      transactionDate: '2026-05-31T08:00:00.000Z',
    });
    const now = new Date('2026-05-31T12:00:00.000Z');

    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: false,
        now,
        transaction: transfer,
      }),
    ).toBe(false);
    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: true,
        now,
        transaction: { ...transfer, status: 'cancelled' },
      }),
    ).toBe(false);
    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: true,
        now,
        transaction: { ...transfer, isCancellation: true },
      }),
    ).toBe(false);
    expect(
      canCancelAccountingTransferTransaction({
        canCreateTransfer: true,
        now,
        transaction: { ...transfer, cancelsTransactionId: 'tx-old' },
      }),
    ).toBe(false);
    expect(
      canCancelAccountingTransaction({
        canCreateDeposit: true,
        canCreateWithdraw: true,
        canCreateTransfer: true,
        now,
        transaction: { ...transfer, type: 'deposit', toCashbox: { id: 'cash-2', name: 'Reserve' }, fromCashbox: null },
      }),
    ).toBe(true);
    expect(
      canCancelAccountingTransaction({
        canCreateDeposit: true,
        canCreateWithdraw: false,
        canCreateTransfer: false,
        now,
        transaction: { ...transfer, type: 'deposit', toCashbox: { id: 'cash-2', name: 'Reserve' }, fromCashbox: null },
      }),
    ).toBe(true);
    expect(
      canCancelAccountingTransaction({
        canCreateDeposit: false,
        canCreateWithdraw: true,
        canCreateTransfer: false,
        now,
        transaction: { ...transfer, type: 'withdraw', fromCashbox: { id: 'cash-1', name: 'Main' }, toCashbox: null },
      }),
    ).toBe(true);
    expect(
      canCancelAccountingTransaction({
        canCreateDeposit: true,
        canCreateWithdraw: true,
        canCreateTransfer: true,
        now,
        transaction: { ...transfer, note: 'Payment for order SO-1' },
      }),
    ).toBe(false);
    expect(isAccountingOrderLinkedNote('Supplier order payment: SO-1')).toBe(true);
  });

  it('restores remembered cashbox operation fields when available', () => {
    const cashboxes = [createCashbox('cash-1', { UAH: 100 }), createCashbox('cash-2', { UAH: 50 })];
    const memory = upsertLastOperationByCashbox({}, 'withdraw', {
      fromCashboxId: 'cash-2',
      toCashboxId: '',
      currency: 'UAH',
    });

    expect(
      resolveCashboxOperationForm({
        type: 'withdraw',
        cashboxId: 'cash-2',
        cashboxes,
        memory,
        secondCashboxId: 'cash-1',
      }),
    ).toMatchObject({
      type: 'withdraw',
      fromCashboxId: 'cash-2',
      toCashboxId: '',
      currency: 'UAH',
    });
  });

  it('validates whether a transfer can be performed between two different cashboxes', () => {
    expect(canPerformTransferBetweenCashboxes('cashbox-1', 'cashbox-2')).toBe(true);
    expect(canPerformTransferBetweenCashboxes('cashbox-1', 'cashbox-1')).toBe(false);
    expect(canPerformTransferBetweenCashboxes('cashbox-1', '')).toBe(false);
    expect(canPerformTransferBetweenCashboxes('', 'cashbox-2')).toBe(false);
    expect(canPerformTransferBetweenCashboxes(undefined, 'cashbox-2')).toBe(false);
    expect(canPerformTransferBetweenCashboxes('cashbox-1', undefined)).toBe(false);
  });

  it('parses order token only from documented payment/refund note patterns', () => {
    expect(parseTransactionOrderToken('Payment for order r000066')).toBe('r000066');
    expect(parseTransactionOrderToken('Refund for order ABC-123')).toBe('ABC-123');
    expect(parseTransactionOrderToken('Оплата замовлення SO-42')).toBe('SO-42');
    expect(parseTransactionOrderToken('Оплата за замовлення SO-42')).toBe('SO-42');
    expect(parseTransactionOrderToken('payment for order x1')).toBe('x1'); // case insen
    expect(parseTransactionOrderToken('Some other note with order foo')).toBe(null);
    expect(parseTransactionOrderToken('Deposit manual')).toBe(null);
    expect(parseTransactionOrderToken('')).toBe(null);
    expect(parseTransactionOrderToken(null)).toBe(null);
    expect(parseTransactionOrderToken('Payment for order r000066 extra')).toBe('r000066');
  });
});
