import mongoose from 'mongoose';
import {
  Cashbox,
  FinanceTransaction,
  financeCurrencies,
  transactionTypes,
  type CashboxDocument,
  type FinanceCurrency,
  type FinanceTransactionDocument,
  type TransactionType,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';

type CashboxPayload = {
  name?: unknown;
};

type TransactionPayload = {
  type?: unknown;
  amount?: unknown;
  currency?: unknown;
  fromCashboxId?: unknown;
  toCashboxId?: unknown;
  note?: unknown;
  transactionDate?: unknown;
};

const defaultCashboxName = 'Основная';

const normalizeName = (value: unknown) => String(value ?? '').trim();

const normalizeAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Transaction amount must be greater than 0.');
  }

  return Math.round(amount * 100) / 100;
};

const normalizeCurrency = (value: unknown): FinanceCurrency => {
  const currency = String(value ?? 'UAH').toUpperCase();
  if (!financeCurrencies.includes(currency as FinanceCurrency)) {
    throw new Error('Unsupported transaction currency.');
  }

  return currency as FinanceCurrency;
};

const normalizeType = (value: unknown): TransactionType => {
  const type = String(value ?? '');
  if (!transactionTypes.includes(type as TransactionType)) {
    throw new Error('Unsupported transaction type.');
  }

  return type as TransactionType;
};

const normalizeDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid transaction date.');
  }

  return date;
};

const formatCashbox = (cashbox: CashboxDocument) => ({
  id: cashbox._id.toString(),
  name: cashbox.name,
  balances: {
    UAH: cashbox.balances?.UAH ?? 0,
    USD: cashbox.balances?.USD ?? 0,
  },
  isDefault: cashbox.isDefault,
  isArchived: cashbox.isArchived,
  createdAt: cashbox.createdAt.toISOString(),
  updatedAt: cashbox.updatedAt.toISOString(),
});

const formatTransaction = (transaction: FinanceTransactionDocument) => ({
  id: transaction._id.toString(),
  type: transaction.type,
  amount: transaction.amount,
  currency: transaction.currency,
  fromCashbox: transaction.fromCashbox
    ? {
        id: transaction.fromCashbox.toString(),
        name: transaction.fromSnapshot?.name ?? '',
      }
    : null,
  toCashbox: transaction.toCashbox
    ? {
        id: transaction.toCashbox.toString(),
        name: transaction.toSnapshot?.name ?? '',
      }
    : null,
  note: transaction.note,
  transactionDate: transaction.transactionDate.toISOString(),
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),
});

export const ensureDefaultCashbox = async () => {
  let cashbox = await Cashbox.findOne({ isDefault: true }).lean<CashboxDocument | null>();
  if (cashbox) return cashbox;

  const created = await Cashbox.findOneAndUpdate(
    { name: defaultCashboxName },
    {
      $setOnInsert: {
        name: defaultCashboxName,
        balances: { UAH: 0, USD: 0 },
      },
      $set: { isDefault: true, isArchived: false },
    },
    { upsert: true, new: true, runValidators: true },
  ).lean<CashboxDocument | null>();

  if (!created) {
    throw new Error('Failed to create default cashbox.');
  }

  return created;
};

export const listCashboxes = async () => {
  await ensureDefaultCashbox();
  const cashboxes = await Cashbox.find({ isArchived: false })
    .sort({ isDefault: -1, createdAt: 1 })
    .lean<CashboxDocument[]>();

  return cashboxes.map(formatCashbox);
};

export const createCashbox = async (payload: CashboxPayload) => {
  const name = normalizeName(payload.name);
  if (name.length < 2) {
    throw new Error('Cashbox name must contain at least 2 characters.');
  }

  const cashbox = new Cashbox({
    name,
    balances: { UAH: 0, USD: 0 },
  });
  await cashbox.validate();
  await cashbox.save();

  return formatCashbox(cashbox.toObject<CashboxDocument>());
};

const getCashboxOrThrow = async (cashboxId: unknown, field: string) => {
  const id = String(cashboxId ?? '');
  isValidObjectIdOrThrow(id, field);
  const cashbox = await Cashbox.findById(id).lean<CashboxDocument | null>();
  if (!cashbox || cashbox.isArchived) {
    throw new Error(`${field} cashbox not found.`);
  }

  return cashbox;
};

const applyCashboxDelta = async (
  cashboxId: mongoose.Types.ObjectId | string,
  currency: FinanceCurrency,
  delta: number,
) => {
  const cashbox = await Cashbox.findById(cashboxId).lean<CashboxDocument | null>();
  if (!cashbox) {
    throw new Error('Cashbox not found.');
  }

  const currentBalance = cashbox.balances?.[currency] ?? 0;
  if (currentBalance + delta < 0) {
    throw new Error('Cashbox balance cannot become negative.');
  }

  await Cashbox.findByIdAndUpdate(cashboxId, {
    $inc: { [`balances.${currency}`]: delta },
  });
};

export const createFinanceTransaction = async (payload: TransactionPayload) => {
  await ensureDefaultCashbox();

  const type = normalizeType(payload.type);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const note = String(payload.note ?? '').trim();
  const transactionDate = normalizeDate(payload.transactionDate);

  const fromCashbox =
    type === 'withdraw' || type === 'transfer'
      ? await getCashboxOrThrow(payload.fromCashboxId, 'fromCashboxId')
      : null;
  const toCashbox =
    type === 'deposit' || type === 'transfer'
      ? await getCashboxOrThrow(payload.toCashboxId, 'toCashboxId')
      : null;

  if (type === 'transfer' && fromCashbox?._id.toString() === toCashbox?._id.toString()) {
    throw new Error('Transfer cashboxes must be different.');
  }

  if (fromCashbox) {
    await applyCashboxDelta(fromCashbox._id, currency, -amount);
  }
  try {
    if (toCashbox) {
      await applyCashboxDelta(toCashbox._id, currency, amount);
    }

    const transaction = new FinanceTransaction({
      type,
      amount,
      currency,
      fromCashbox: fromCashbox?._id ?? null,
      toCashbox: toCashbox?._id ?? null,
      fromSnapshot: fromCashbox ? { name: fromCashbox.name } : undefined,
      toSnapshot: toCashbox ? { name: toCashbox.name } : undefined,
      note,
      transactionDate,
    });

    await transaction.validate();
    await transaction.save();

    return formatTransaction(transaction.toObject<FinanceTransactionDocument>());
  } catch (error) {
    if (fromCashbox) {
      await applyCashboxDelta(fromCashbox._id, currency, amount);
    }
    if (toCashbox) {
      await applyCashboxDelta(toCashbox._id, currency, -amount);
    }
    throw error;
  }
};

export const listFinanceTransactions = async () => {
  await ensureDefaultCashbox();
  const transactions = await FinanceTransaction.find()
    .sort({ transactionDate: -1, createdAt: -1 })
    .limit(100)
    .lean<FinanceTransactionDocument[]>();

  return transactions.map(formatTransaction);
};

export const getFinanceReport = async () => {
  const [cashboxes, transactions] = await Promise.all([
    listCashboxes(),
    listFinanceTransactions(),
  ]);

  const totals = cashboxes.reduce(
    (summary, cashbox) => ({
      UAH: summary.UAH + cashbox.balances.UAH,
      USD: summary.USD + cashbox.balances.USD,
    }),
    { UAH: 0, USD: 0 },
  );
  const today = new Date().toISOString().slice(0, 10);
  const todayTransactions = transactions.filter((transaction) =>
    transaction.transactionDate.startsWith(today),
  );

  return {
    totals,
    cashboxCount: cashboxes.length,
    transactionCount: transactions.length,
    todayTransactionCount: todayTransactions.length,
    todayTurnover: todayTransactions.reduce(
      (summary, transaction) => ({
        ...summary,
        [transaction.currency]: summary[transaction.currency] + transaction.amount,
      }),
      { UAH: 0, USD: 0 },
    ),
  };
};
