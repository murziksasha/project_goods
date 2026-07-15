import {
  baseFinanceCurrency,
  transactionTypes,
  type FinanceCurrency,
  type TransactionType,
} from './model';
import { toNumber } from '../../shared/lib/parsers';
import { HttpError } from '../../shared/lib/errors';

export type CashboxPayload = {
  name?: unknown;
};

export type UpdateCashboxPayload = {
  name?: unknown;
  isArchived?: unknown;
  enabledCurrencies?: unknown;
};

export type CurrencyPayload = {
  code?: unknown;
};

export type UpdateCurrencyPayload = {
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
  idempotencyKey?: unknown;
};

export const normalizeName = (value: unknown) => String(value ?? '').trim();

export const normalizeCurrencyCode = (value: unknown): FinanceCurrency => {
  const currency = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3,6}$/.test(currency)) {
    throw new HttpError(400, 'Currency code must be 3-6 latin letters.');
  }

  return currency;
};

export const normalizeAmount = (value: unknown) => {
  const amount = toNumber(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Transaction amount must be greater than 0.');
  }

  return Math.round(amount * 100) / 100;
};

export const normalizeCurrency = (value: unknown): FinanceCurrency => {
  return normalizeCurrencyCode(value ?? baseFinanceCurrency);
};

export const normalizeType = (value: unknown): TransactionType => {
  const type = String(value ?? '');
  if (!transactionTypes.includes(type as TransactionType)) {
    throw new HttpError(400, 'Unsupported transaction type.');
  }

  return type as TransactionType;
};

export const normalizeDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, 'Invalid transaction date.');
  }

  return date;
};

export const normalizeEnabledCurrencies = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Enabled currencies must be an object.');
  }
  const payload = value as Record<string, unknown>;
  if (payload[baseFinanceCurrency] === false) {
    throw new HttpError(400, 'UAH currency cannot be disabled.');
  }

  return Object.entries(payload).reduce<Record<string, boolean>>(
    (acc, [currencyCode, enabled]) => {
      const normalizedCode = normalizeCurrencyCode(currencyCode);
      acc[normalizedCode] = normalizedCode === baseFinanceCurrency || enabled === true;
      return acc;
    },
    { [baseFinanceCurrency]: true },
  );
};
