import {
  financeCurrencies,
  transactionTypes,
  type FinanceCurrency,
  type TransactionType,
} from './model';

export type CashboxPayload = {
  name?: unknown;
};

export type UpdateCashboxPayload = {
  name?: unknown;
  isArchived?: unknown;
};

export type TransactionPayload = {
  type?: unknown;
  amount?: unknown;
  currency?: unknown;
  fromCashboxId?: unknown;
  toCashboxId?: unknown;
  note?: unknown;
  transactionDate?: unknown;
};

export const normalizeName = (value: unknown) => String(value ?? '').trim();

export const normalizeAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be greater than 0.');
  }

  return Math.round(amount * 100) / 100;
};

export const normalizeCurrency = (value: unknown): FinanceCurrency => {
  const currency = String(value ?? 'UAH').toUpperCase();
  if (!financeCurrencies.includes(currency as FinanceCurrency)) {
    throw new Error('Unsupported transaction currency.');
  }

  return currency as FinanceCurrency;
};

export const normalizeType = (value: unknown): TransactionType => {
  const type = String(value ?? '');
  if (!transactionTypes.includes(type as TransactionType)) {
    throw new Error('Unsupported transaction type.');
  }

  return type as TransactionType;
};

export const normalizeDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid transaction date.');
  }

  return date;
};
