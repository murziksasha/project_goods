import { HttpError } from '../../shared/lib/errors';
import {
  financeTransactionCategories,
  type FinanceTransactionCategory,
  type TransactionType,
} from './model';

export { financeTransactionCategories };
export type { FinanceTransactionCategory };

export const manualWithdrawCategories = [
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;

export type ManualWithdrawCategory = (typeof manualWithdrawCategories)[number];

const CLIENT_PAYMENT_NOTE =
  /^(?:Payment for order|Оплата (?:за )?замовлення)\s+/iu;
const SUPPLIER_PAYMENT_NOTE = /^Supplier order payment:/i;
const REFUND_NOTE =
  /^(?:Refund for order|Serial return for sale|Full return for sale|Return for sale)\s+/i;

export const isFinanceTransactionCategory = (
  value: unknown,
): value is FinanceTransactionCategory =>
  typeof value === 'string' &&
  financeTransactionCategories.includes(value as FinanceTransactionCategory);

export const normalizeOptionalCategory = (
  value: unknown,
): FinanceTransactionCategory | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isFinanceTransactionCategory(value)) {
    throw new HttpError(400, 'Unsupported finance transaction category.');
  }
  return value;
};

export const inferFinanceTransactionCategory = (
  type: TransactionType,
  note: string,
): FinanceTransactionCategory | undefined => {
  if (type === 'transfer') return undefined;
  const trimmed = String(note ?? '').trim();

  if (type === 'deposit') {
    return CLIENT_PAYMENT_NOTE.test(trimmed) ? 'client_payment' : 'other';
  }

  if (REFUND_NOTE.test(trimmed)) return 'client_refund';
  if (SUPPLIER_PAYMENT_NOTE.test(trimmed) || CLIENT_PAYMENT_NOTE.test(trimmed)) {
    return 'supplier_payment';
  }
  return 'other';
};

export const resolveFinanceTransactionCategory = (
  type: TransactionType,
  note: string,
  explicit?: unknown,
): FinanceTransactionCategory | undefined => {
  if (type === 'transfer') return undefined;
  return (
    normalizeOptionalCategory(explicit) ??
    inferFinanceTransactionCategory(type, note) ??
    'other'
  );
};
