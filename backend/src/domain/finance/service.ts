import mongoose from 'mongoose';
import {
  Cashbox,
  FinanceTransaction,
  type CashboxDocument,
  type FinanceCurrency,
  type FinanceTransactionDocument,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { formatCashbox, formatTransaction } from './formatters';
import {
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizeName,
  normalizeType,
  type CashboxPayload,
  type TransactionPayload,
  type UpdateCashboxPayload,
} from './normalizers';

const defaultCashboxName = 'Основная';

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
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean<CashboxDocument | null>();

  if (!created) {
    throw new Error('Failed to create default cashbox.');
  }

  return created;
};

export const listCashboxes = async (options: { includeArchived?: boolean } = {}) => {
  await ensureDefaultCashbox();
  const query = options.includeArchived ? {} : { isArchived: false };
  const cashboxes = await Cashbox.find(query)
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

export const updateCashbox = async (
  cashboxId: string,
  payload: UpdateCashboxPayload,
) => {
  isValidObjectIdOrThrow(cashboxId, 'cashboxId');
  const existing = await Cashbox.findById(cashboxId).lean<CashboxDocument | null>();
  if (!existing) {
    throw new Error('Cashbox not found.');
  }

  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const nextName = normalizeName(payload.name);
    if (nextName.length < 2) {
      throw new Error('Cashbox name must contain at least 2 characters.');
    }
    patch.name = nextName;
  }
  if (payload.isArchived !== undefined) {
    const nextArchived = Boolean(payload.isArchived);
    if (existing.isDefault && nextArchived) {
      throw new Error('Default cashbox cannot be deactivated.');
    }
    patch.isArchived = nextArchived;
  }
  if (Object.keys(patch).length === 0) {
    return formatCashbox(existing);
  }

  const updated = await Cashbox.findByIdAndUpdate(
    cashboxId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean<CashboxDocument | null>();
  if (!updated) {
    throw new Error('Cashbox not found.');
  }

  return formatCashbox(updated);
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

export const cancelFinanceTransaction = async (transactionId: string) => {
  isValidObjectIdOrThrow(transactionId, 'transactionId');

  const transaction = await FinanceTransaction.findById(transactionId)
    .lean<FinanceTransactionDocument | null>();
  if (!transaction) {
    throw new Error('Transaction not found.');
  }

  if (transaction.type !== 'transfer' || !transaction.fromCashbox || !transaction.toCashbox) {
    throw new Error('Only transfers between cashboxes can be cancelled.');
  }
  if ((transaction.status ?? 'active') === 'cancelled') {
    throw new Error('Transaction is already cancelled.');
  }
  if (transaction.isCancellation || transaction.cancelsTransaction) {
    throw new Error('Cancellation transactions cannot be cancelled.');
  }

  const fromCashbox = await Cashbox.findById(transaction.fromCashbox)
    .lean<CashboxDocument | null>();
  const toCashbox = await Cashbox.findById(transaction.toCashbox)
    .lean<CashboxDocument | null>();
  if (!fromCashbox || !toCashbox) {
    throw new Error('Transaction cashbox not found.');
  }

  let fromDeltaApplied = false;
  await applyCashboxDelta(toCashbox._id, transaction.currency, -transaction.amount);
  try {
    await applyCashboxDelta(fromCashbox._id, transaction.currency, transaction.amount);
    fromDeltaApplied = true;

    const cancellation = new FinanceTransaction({
      type: 'transfer',
      amount: transaction.amount,
      currency: transaction.currency,
      fromCashbox: toCashbox._id,
      toCashbox: fromCashbox._id,
      fromSnapshot: { name: toCashbox.name },
      toSnapshot: { name: fromCashbox.name },
      note: `Cancellation of transfer ${transaction._id.toString()}${transaction.note ? `: ${transaction.note}` : ''}`,
      transactionDate: new Date(),
      isCancellation: true,
      cancelsTransaction: transaction._id,
    });

    await cancellation.validate();
    await cancellation.save();

    const cancelled = await FinanceTransaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: { $ne: 'cancelled' },
        isCancellation: { $ne: true },
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationTransaction: cancellation._id,
        },
      },
      { returnDocument: 'after', runValidators: true },
    ).lean<FinanceTransactionDocument | null>();

    if (!cancelled) {
      await FinanceTransaction.findByIdAndDelete(cancellation._id);
      await applyCashboxDelta(fromCashbox._id, transaction.currency, -transaction.amount);
      fromDeltaApplied = false;
      throw new Error('Transaction is already cancelled.');
    }

    return formatTransaction(cancelled);
  } catch (error) {
    if (fromDeltaApplied) {
      await applyCashboxDelta(fromCashbox._id, transaction.currency, -transaction.amount);
    }
    await applyCashboxDelta(toCashbox._id, transaction.currency, transaction.amount);
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
