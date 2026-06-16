import { HttpError } from '../../shared/lib/errors';
import { toNumber } from '../../shared/lib/parsers';
import { transactionTypes, type TransactionType } from './model';
import type { TransactionPayload } from './normalizers';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRequiredText = (
  payload: Record<string, unknown>,
  field: keyof TransactionPayload,
  message: string,
) => {
  const value = payload[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, message);
  }
  return value.trim();
};

export const validateFinanceTransactionPayload = (
  payload: unknown,
): TransactionPayload => {
  if (!isRecord(payload)) {
    throw new HttpError(400, 'Finance transaction payload must be an object.');
  }

  const type = String(payload.type ?? '') as TransactionType;
  if (!transactionTypes.includes(type)) {
    throw new HttpError(400, 'Unsupported transaction type.');
  }

  const amount = toNumber(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Transaction amount must be greater than 0.');
  }

  if (
    payload.currency !== undefined &&
    !/^[A-Z]{3,6}$/.test(String(payload.currency).trim().toUpperCase())
  ) {
    throw new HttpError(400, 'Currency code must be 3-6 latin letters.');
  }

  if (payload.transactionDate !== undefined) {
    const date = new Date(String(payload.transactionDate));
    if (Number.isNaN(date.getTime())) {
      throw new HttpError(400, 'Invalid transaction date.');
    }
  }

  if (payload.note !== undefined && typeof payload.note !== 'string') {
    throw new HttpError(400, 'Transaction note must be a string.');
  }

  if (
    payload.idempotencyKey !== undefined &&
    typeof payload.idempotencyKey !== 'string'
  ) {
    throw new HttpError(400, 'Idempotency key must be a string.');
  }

  if (type === 'deposit') {
    readRequiredText(payload, 'toCashboxId', 'toCashboxId is required for deposit.');
  }

  if (type === 'withdraw') {
    readRequiredText(
      payload,
      'fromCashboxId',
      'fromCashboxId is required for withdraw.',
    );
  }

  if (type === 'transfer') {
    const fromCashboxId = readRequiredText(
      payload,
      'fromCashboxId',
      'fromCashboxId is required for transfer.',
    );
    const toCashboxId = readRequiredText(
      payload,
      'toCashboxId',
      'toCashboxId is required for transfer.',
    );
    if (fromCashboxId === toCashboxId) {
      throw new HttpError(400, 'Transfer cashboxes must be different.');
    }
  }

  return payload;
};
