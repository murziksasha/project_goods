import { describe, expect, it } from 'vitest';
import {
  buildFinanceTransactionsFilter,
  FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
  FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT,
  hasFinanceTransactionsDateFilter,
  parseListFinanceTransactionsQuery,
} from './list-transactions-query';

describe('list-transactions-query', () => {
  it('applies defaults for empty query', () => {
    expect(parseListFinanceTransactionsQuery({})).toEqual({
      page: 1,
      pageSize: FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
      sortBy: 'date',
      sortDirection: 'desc',
    });
  });

  it('parses filters, pagination, and clamps page size', () => {
    const options = parseListFinanceTransactionsQuery({
      page: '2',
      pageSize: '500',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      type: 'withdraw',
      currency: 'uah',
      fromCashboxId: '111111111111111111111111',
      toCashboxId: '222222222222222222222222',
      cashboxId: '333333333333333333333333',
      note: 'Payment',
      sortBy: 'amount',
      sortDirection: 'asc',
    });

    expect(options.page).toBe(2);
    expect(options.pageSize).toBe(200);
    expect(options.currency).toBe('UAH');
    expect(options.type).toBe('withdraw');
    expect(hasFinanceTransactionsDateFilter(options)).toBe(true);
  });

  it('builds mongo filter with date range and cashbox scope', () => {
    const filter = buildFinanceTransactionsFilter(
      parseListFinanceTransactionsQuery({
        dateFrom: '2026-03-01',
        dateTo: '2026-03-31',
        cashboxId: '111111111111111111111111',
        note: 'order',
      }),
    );

    expect(filter.$or).toEqual([
      { fromCashbox: '111111111111111111111111' },
      { toCashbox: '111111111111111111111111' },
    ]);
    expect(filter.note).toEqual({
      $regex: 'order',
      $options: 'i',
    });
    expect(filter.transactionDate).toEqual({
      $gte: new Date('2026-03-01T00:00:00.000Z'),
      $lte: new Date('2026-03-31T23:59:59.999Z'),
    });
  });

  it('exposes recent window constant', () => {
    expect(FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT).toBe(200);
  });
});