import type { SortOrder } from 'mongoose';
import { escapeRegExp } from '../../shared/lib/query';
import { transactionTypes, type TransactionType } from './model';

export const FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT = 200;
export const FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE = 30;
export const FINANCE_TRANSACTIONS_MAX_PAGE_SIZE = 200;

export const financeTransactionSortFields = [
  'date',
  'type',
  'amount',
  'currency',
  'from',
  'to',
] as const;

export type FinanceTransactionSortField =
  (typeof financeTransactionSortFields)[number];

export type ListFinanceTransactionsOptions = {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  type?: TransactionType;
  currency?: string;
  fromCashboxId?: string;
  toCashboxId?: string;
  cashboxId?: string;
  note?: string;
  sortBy: FinanceTransactionSortField;
  sortDirection: 'asc' | 'desc';
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseDateKey = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return DATE_KEY_PATTERN.test(normalized) ? normalized : undefined;
};

const parseSortField = (value: unknown): FinanceTransactionSortField => {
  const normalized = String(value ?? '').trim();
  return financeTransactionSortFields.includes(
    normalized as FinanceTransactionSortField,
  )
    ? (normalized as FinanceTransactionSortField)
    : 'date';
};

const parseSortDirection = (value: unknown): 'asc' | 'desc' =>
  String(value ?? '').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

const parseTransactionType = (value: unknown): TransactionType | undefined => {
  const normalized = String(value ?? '').trim();
  return transactionTypes.includes(normalized as TransactionType)
    ? (normalized as TransactionType)
    : undefined;
};

const parseObjectId = (value: unknown) => {
  const normalized = String(value ?? '').trim();
  return /^[a-f\d]{24}$/i.test(normalized) ? normalized : undefined;
};

export const parseListFinanceTransactionsQuery = (
  query: Record<string, unknown> = {},
): ListFinanceTransactionsOptions => ({
  page: parsePositiveInt(query.page, 1),
  pageSize: clamp(
    parsePositiveInt(
      query.pageSize,
      FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
    ),
    1,
    FINANCE_TRANSACTIONS_MAX_PAGE_SIZE,
  ),
  dateFrom: parseDateKey(query.dateFrom),
  dateTo: parseDateKey(query.dateTo),
  type: parseTransactionType(query.type),
  currency: String(query.currency ?? '').trim().toUpperCase() || undefined,
  fromCashboxId: parseObjectId(query.fromCashboxId),
  toCashboxId: parseObjectId(query.toCashboxId),
  cashboxId: parseObjectId(query.cashboxId),
  note: String(query.note ?? '').trim() || undefined,
  sortBy: parseSortField(query.sortBy),
  sortDirection: parseSortDirection(query.sortDirection),
});

export type FinanceTransactionsMongoFilter = Record<string, unknown>;

export const buildFinanceTransactionsFilter = (
  options: ListFinanceTransactionsOptions,
): FinanceTransactionsMongoFilter => {
  const filter: FinanceTransactionsMongoFilter = {};

  if (options.type) {
    filter.type = options.type;
  }

  if (options.currency) {
    filter.currency = options.currency;
  }

  if (options.fromCashboxId) {
    filter.fromCashbox = options.fromCashboxId;
  }

  if (options.toCashboxId) {
    filter.toCashbox = options.toCashboxId;
  }

  if (options.cashboxId) {
    filter.$or = [
      { fromCashbox: options.cashboxId },
      { toCashbox: options.cashboxId },
    ];
  }

  if (options.note) {
    filter.note = {
      $regex: escapeRegExp(options.note),
      $options: 'i',
    };
  }

  if (options.dateFrom || options.dateTo) {
    const transactionDate: Record<string, Date> = {};
    if (options.dateFrom) {
      transactionDate.$gte = new Date(`${options.dateFrom}T00:00:00.000Z`);
    }
    if (options.dateTo) {
      transactionDate.$lte = new Date(`${options.dateTo}T23:59:59.999Z`);
    }
    filter.transactionDate = transactionDate;
  }

  return filter;
};

export const getFinanceTransactionsSort = (
  options: ListFinanceTransactionsOptions,
): Record<string, SortOrder> => {
  const direction: SortOrder = options.sortDirection === 'asc' ? 1 : -1;
  const tieBreakers: Record<string, SortOrder> =
    options.sortDirection === 'asc'
      ? { transactionDate: 1, createdAt: 1 }
      : { transactionDate: -1, createdAt: -1 };

  switch (options.sortBy) {
    case 'type':
      return { type: direction, ...tieBreakers };
    case 'amount':
      return { amount: direction, ...tieBreakers };
    case 'currency':
      return { currency: direction, ...tieBreakers };
    case 'from':
      return { 'fromSnapshot.name': direction, ...tieBreakers };
    case 'to':
      return { 'toSnapshot.name': direction, ...tieBreakers };
    case 'date':
    default:
      return { transactionDate: direction, createdAt: direction };
  }
};

export const hasFinanceTransactionsDateFilter = (
  options: ListFinanceTransactionsOptions,
) => Boolean(options.dateFrom || options.dateTo);