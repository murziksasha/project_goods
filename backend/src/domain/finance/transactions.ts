import type mongoose from 'mongoose';
import {
  Cashbox,
  FinanceTransaction,
  type CashboxDocument,
  type FinanceTransactionDocument,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { formatTransaction } from './formatters';
import {
  normalizeAmount,
  normalizeCurrency,
  normalizeDate,
  normalizeType,
  type TransactionPayload,
} from './normalizers';
import {
  applyCashboxDelta,
  assertCashboxCanAcceptCurrency,
  assertCashboxCanWithdrawCurrency,
  getAccountingBusinessDateKey,
  getCashboxOrThrow,
  getCurrencyCodes,
  getCurrencyConfigOrThrow,
  leanWithOptionalSession,
  withOptionalFinanceSession,
} from './internal';
import { ensureDefaultCashbox, listCashboxes } from './cashboxes';
import { computeBalanceAfterByTransactionId } from './balance-after';
import {
  buildFinanceTransactionsFilter,
  FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT,
  getFinanceTransactionsSort,
  hasFinanceTransactionsDateFilter,
  parseListFinanceTransactionsQuery,
  type ListFinanceTransactionsOptions,
} from './list-transactions-query';

const transactionCancellationDayError =
  'Transaction can be cancelled only during the transaction day.';

const ORDER_LINKED_NOTE_PATTERNS = [
  /Payment for order\s+[\p{L}\p{N}-]+/iu,
  /Refund for order\s+[\p{L}\p{N}-]+/iu,
  /Оплата (?:за )?замовлення\s+[\p{L}\p{N}-]+/iu,
  /^Supplier order payment:/i,
];

export const isOrderLinkedFinanceTransactionNote = (
  note: string | null | undefined,
): boolean => {
  if (!note) return false;
  const trimmed = note.trim();
  return ORDER_LINKED_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed));
};


export const getFinanceTransactionTypeForCancel = async (
  transactionId: string,
): Promise<FinanceTransactionDocument['type']> => {
  isValidObjectIdOrThrow(transactionId, 'transactionId');
  const transaction = await FinanceTransaction.findById(transactionId).lean<
    FinanceTransactionDocument | null
  >();
  if (!transaction) {
    throw new Error('Transaction not found.');
  }
  return transaction.type;
};


const runCreateFinanceTransaction = async (
  payload: TransactionPayload,
  session?: mongoose.ClientSession,
) => {
  await ensureDefaultCashbox(session);

  const type = normalizeType(payload.type);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const note = String(payload.note ?? '').trim();
  const transactionDate = normalizeDate(payload.transactionDate);
  const idempotencyKey = String(payload.idempotencyKey ?? '').trim();

  if (idempotencyKey) {
    const existing = await leanWithOptionalSession<FinanceTransactionDocument | null>(
      FinanceTransaction.findOne({ idempotencyKey }),
      session,
    );
    if (existing) return formatTransaction(existing);
  }

  const currencyConfig = await getCurrencyConfigOrThrow(currency, session);
  if (currencyConfig.isArchived && type !== 'withdraw') {
    throw new Error('Archived currency cannot be used for this operation.');
  }

  const fromCashbox =
    type === 'withdraw' || type === 'transfer'
      ? await getCashboxOrThrow(payload.fromCashboxId, 'fromCashboxId', session)
      : null;
  const toCashbox =
    type === 'deposit' || type === 'transfer'
      ? await getCashboxOrThrow(payload.toCashboxId, 'toCashboxId', session)
      : null;

  if (type === 'transfer' && fromCashbox?._id.toString() === toCashbox?._id.toString()) {
    throw new Error('Transfer cashboxes must be different.');
  }
  if (fromCashbox) {
    assertCashboxCanWithdrawCurrency(fromCashbox, currency);
  }
  if (toCashbox) {
    assertCashboxCanAcceptCurrency(toCashbox, currency);
  }

  if (fromCashbox) {
    await applyCashboxDelta(fromCashbox._id, currency, -amount, session);
  }
  try {
    if (toCashbox) {
      await applyCashboxDelta(toCashbox._id, currency, amount, session);
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
      idempotencyKey,
    });

    await transaction.validate();
    await transaction.save({ session });

    return formatTransaction(transaction.toObject<FinanceTransactionDocument>());
  } catch (error: any) {
    if (idempotencyKey && error?.code === 11000) {
      const existing = await leanWithOptionalSession<FinanceTransactionDocument | null>(
        FinanceTransaction.findOne({ idempotencyKey }),
        session,
      );
      if (existing) {
        if (fromCashbox) {
          await applyCashboxDelta(fromCashbox._id, currency, amount, session);
        }
        if (toCashbox) {
          await applyCashboxDelta(toCashbox._id, currency, -amount, session);
        }
        return formatTransaction(existing);
      }
    }
    if (!session) {
      if (fromCashbox) {
        await applyCashboxDelta(fromCashbox._id, currency, amount);
      }
      if (toCashbox) {
        await applyCashboxDelta(toCashbox._id, currency, -amount);
      }
    }
    throw error;
  }
};

export const createFinanceTransaction = async (
  payload: TransactionPayload,
  options?: { session?: mongoose.ClientSession },
) => {
  if (options?.session) {
    return runCreateFinanceTransaction(payload, options.session);
  }
  return withOptionalFinanceSession((session) =>
    runCreateFinanceTransaction(payload, session),
  );
};


export const cancelFinanceTransaction = async (transactionId: string) => {
  return withOptionalFinanceSession(async (session) => {
    isValidObjectIdOrThrow(transactionId, 'transactionId');

    const transaction = await leanWithOptionalSession<FinanceTransactionDocument | null>(
      FinanceTransaction.findById(transactionId),
      session,
    );
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    if (!['deposit', 'withdraw', 'transfer'].includes(transaction.type)) {
      throw new Error('Only manual finance transactions can be cancelled.');
    }
    if (transaction.type === 'deposit' && !transaction.toCashbox) {
      throw new Error('Deposit transaction cashbox not found.');
    }
    if (transaction.type === 'withdraw' && !transaction.fromCashbox) {
      throw new Error('Withdraw transaction cashbox not found.');
    }
    if (
      transaction.type === 'transfer' &&
      (!transaction.fromCashbox || !transaction.toCashbox)
    ) {
      throw new Error('Transfer transaction cashboxes not found.');
    }
    if ((transaction.status ?? 'active') === 'cancelled') {
      throw new Error('Transaction is already cancelled.');
    }
    if (transaction.isCancellation || transaction.cancelsTransaction) {
      throw new Error('Cancellation transactions cannot be cancelled.');
    }
    if (isOrderLinkedFinanceTransactionNote(transaction.note)) {
      throw new Error('Order-linked finance transactions cannot be cancelled.');
    }
    if (
      getAccountingBusinessDateKey(transaction.transactionDate) !==
      getAccountingBusinessDateKey(new Date())
    ) {
      throw new Error(transactionCancellationDayError);
    }

    const fromCashbox =
      transaction.fromCashbox &&
      (await leanWithOptionalSession<CashboxDocument | null>(
        Cashbox.findById(transaction.fromCashbox),
        session,
      ));
    const toCashbox =
      transaction.toCashbox &&
      (await leanWithOptionalSession<CashboxDocument | null>(
        Cashbox.findById(transaction.toCashbox),
        session,
      ));

    if (transaction.type === 'transfer' && (!fromCashbox || !toCashbox)) {
      throw new Error('Transaction cashbox not found.');
    }
    if (transaction.type === 'deposit' && !toCashbox) {
      throw new Error('Transaction cashbox not found.');
    }
    if (transaction.type === 'withdraw' && !fromCashbox) {
      throw new Error('Transaction cashbox not found.');
    }

    const cancellationNote = `Cancellation of ${transaction.type} ${transaction._id.toString()}${transaction.note ? `: ${transaction.note}` : ''}`;
    let primaryDeltaApplied = false;
    let secondaryDeltaApplied = false;

    const rollbackWithoutSession = async () => {
      if (!session) {
        if (transaction.type === 'transfer' && fromCashbox && toCashbox) {
          if (secondaryDeltaApplied) {
            await applyCashboxDelta(
              fromCashbox._id,
              transaction.currency,
              -transaction.amount,
            );
          }
          if (primaryDeltaApplied) {
            await applyCashboxDelta(
              toCashbox._id,
              transaction.currency,
              transaction.amount,
            );
          }
          return;
        }
        if (transaction.type === 'deposit' && toCashbox && primaryDeltaApplied) {
          await applyCashboxDelta(
            toCashbox._id,
            transaction.currency,
            transaction.amount,
          );
        }
        if (transaction.type === 'withdraw' && fromCashbox && primaryDeltaApplied) {
          await applyCashboxDelta(
            fromCashbox._id,
            transaction.currency,
            -transaction.amount,
          );
        }
      }
    };

    try {
      if (transaction.type === 'transfer' && fromCashbox && toCashbox) {
        await applyCashboxDelta(
          toCashbox._id,
          transaction.currency,
          -transaction.amount,
          session,
        );
        primaryDeltaApplied = true;
        await applyCashboxDelta(
          fromCashbox._id,
          transaction.currency,
          transaction.amount,
          session,
        );
        secondaryDeltaApplied = true;
      } else if (transaction.type === 'deposit' && toCashbox) {
        await applyCashboxDelta(
          toCashbox._id,
          transaction.currency,
          -transaction.amount,
          session,
        );
        primaryDeltaApplied = true;
      } else if (transaction.type === 'withdraw' && fromCashbox) {
        await applyCashboxDelta(
          fromCashbox._id,
          transaction.currency,
          transaction.amount,
          session,
        );
        primaryDeltaApplied = true;
      }

      const cancellationPayload =
        transaction.type === 'transfer' && fromCashbox && toCashbox
          ? {
              type: 'transfer' as const,
              amount: transaction.amount,
              currency: transaction.currency,
              fromCashbox: toCashbox._id,
              toCashbox: fromCashbox._id,
              fromSnapshot: { name: toCashbox.name },
              toSnapshot: { name: fromCashbox.name },
            }
          : transaction.type === 'deposit' && toCashbox
            ? {
                type: 'withdraw' as const,
                amount: transaction.amount,
                currency: transaction.currency,
                fromCashbox: toCashbox._id,
                toCashbox: null,
                fromSnapshot: { name: toCashbox.name },
                toSnapshot: undefined,
              }
            : {
                type: 'deposit' as const,
                amount: transaction.amount,
                currency: transaction.currency,
                fromCashbox: null,
                toCashbox: fromCashbox!._id,
                fromSnapshot: undefined,
                toSnapshot: { name: fromCashbox!.name },
              };

      const cancellation = new FinanceTransaction({
        ...cancellationPayload,
        note: cancellationNote,
        transactionDate: new Date(),
        isCancellation: true,
        cancelsTransaction: transaction._id,
      });

      await cancellation.validate();
      try {
        await cancellation.save({ session });
      } catch (err: any) {
        if (err?.code === 11000 && transaction._id) {
          const existingReverse = await leanWithOptionalSession<FinanceTransactionDocument | null>(
            FinanceTransaction.findOne({ cancelsTransaction: transaction._id }),
            session,
          );
          if (existingReverse) {
            // fallthrough to attempt the mark update which will no-op if already
          }
        } else {
          throw err;
        }
      }

      const cancelled = await leanWithOptionalSession<FinanceTransactionDocument | null>(
        FinanceTransaction.findOneAndUpdate(
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
        ),
        session,
      );

      if (!cancelled) {
        if (!session) {
          await FinanceTransaction.findByIdAndDelete(cancellation._id);
        }
        throw new Error('Transaction is already cancelled.');
      }

      return formatTransaction(cancelled);
    } catch (error) {
      await rollbackWithoutSession();
      throw error;
    }
  });
};


export const updateFinanceTransactionNote = async (
  transactionId: string,
  payload: { note?: unknown },
) => {
  isValidObjectIdOrThrow(transactionId, 'transactionId');

  const note = String(payload.note ?? '').trim();

  if (note.length > 300) {
    throw new Error('Transaction note must contain no more than 300 characters');
  }

  const transaction = await FinanceTransaction.findById(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found.');
  }

  if ((transaction.status ?? 'active') === 'cancelled' || transaction.isCancellation) {
    throw new Error('Cannot edit note for a cancelled transaction.');
  }

  if (isOrderLinkedFinanceTransactionNote(transaction.note)) {
    throw new Error('Order-linked finance transaction notes cannot be edited.');
  }

  transaction.note = note;
  await transaction.save();

  return formatTransaction(transaction.toObject<FinanceTransactionDocument>());
};


export {
  FINANCE_TRANSACTIONS_DEFAULT_PAGE_SIZE,
  FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT,
  FINANCE_TRANSACTIONS_MAX_PAGE_SIZE,
  parseListFinanceTransactionsQuery,
  type ListFinanceTransactionsOptions,
} from './list-transactions-query';

const resolveEffectiveTransactionsFilter = async (
  options: ListFinanceTransactionsOptions,
) => {
  const filter = buildFinanceTransactionsFilter(options);

  if (hasFinanceTransactionsDateFilter(options)) {
    return filter;
  }

  const recentRows = await FinanceTransaction.find(filter)
    .sort({ transactionDate: -1, createdAt: -1 })
    .limit(FINANCE_TRANSACTIONS_DEFAULT_RECENT_LIMIT)
    .select({ _id: 1 })
    .lean<Array<{ _id: FinanceTransactionDocument['_id'] }>>();

  if (recentRows.length === 0) {
    return { _id: { $in: [] } };
  }

  return {
    ...filter,
    _id: { $in: recentRows.map((row) => row._id) },
  };
};

export const listFinanceTransactions = async (
  rawQuery: Record<string, unknown> = {},
) => {
  await ensureDefaultCashbox();
  const options = parseListFinanceTransactionsQuery(rawQuery);
  const effectiveFilter = await resolveEffectiveTransactionsFilter(options);
  const sort = getFinanceTransactionsSort(options);
  const skip = (options.page - 1) * options.pageSize;

  const [total, pageRows, allTransactions, cashboxes] = await Promise.all([
    FinanceTransaction.countDocuments(effectiveFilter),
    FinanceTransaction.find(effectiveFilter)
      .sort(sort)
      .skip(skip)
      .limit(options.pageSize)
      .lean<FinanceTransactionDocument[]>(),
    FinanceTransaction.find()
      .sort({ transactionDate: -1, createdAt: -1 })
      .lean<FinanceTransactionDocument[]>(),
    listCashboxes(),
  ]);

  const balanceAfterByTransactionId = computeBalanceAfterByTransactionId({
    cashboxes: cashboxes.map((cashbox) => ({
      id: cashbox.id,
      balances: cashbox.balances,
    })),
    transactions: allTransactions,
  });

  return {
    items: pageRows.map((transaction) => {
      const formatted = formatTransaction(transaction);
      return {
        ...formatted,
        balanceAfter: balanceAfterByTransactionId[formatted.id] ?? null,
      };
    }),
    total,
    page: options.page,
    pageSize: options.pageSize,
  };
};


export const getFinanceReport = async () => {
  await ensureDefaultCashbox();
  const todayKey = getAccountingBusinessDateKey(new Date());

  const [cashboxes, currencyCodes, transactionCount, transactionDateRows] =
    await Promise.all([
      listCashboxes(),
      getCurrencyCodes({ includeArchived: true }),
      FinanceTransaction.countDocuments({}),
      // Thin projection over all txs — LAN scale; not capped at list limit (100).
      FinanceTransaction.find()
        .select({ transactionDate: 1, amount: 1, currency: 1, status: 1, isCancellation: 1 })
        .lean<
          Array<{
            transactionDate: Date;
            amount: number;
            currency: string;
            status?: string;
            isCancellation?: boolean;
          }>
        >(),
    ]);

  const emptyCurrencyTotals = () =>
    currencyCodes.reduce<Record<string, number>>((acc, currency) => {
      acc[currency] = 0;
      return acc;
    }, {});

  const totals = cashboxes.reduce(
    (summary, cashbox) => {
      currencyCodes.forEach((currency) => {
        summary[currency] = (summary[currency] ?? 0) + (cashbox.balances[currency] ?? 0);
      });
      return summary;
    },
    emptyCurrencyTotals(),
  );

  const todayTurnover = emptyCurrencyTotals();
  let todayTransactionCount = 0;
  for (const row of transactionDateRows) {
    if ((row.status ?? 'active') === 'cancelled') continue;
    if (row.isCancellation) continue;
    if (getAccountingBusinessDateKey(row.transactionDate) !== todayKey) continue;
    todayTransactionCount += 1;
    todayTurnover[row.currency] = (todayTurnover[row.currency] ?? 0) + row.amount;
  }

  return {
    totals,
    cashboxCount: cashboxes.length,
    transactionCount,
    todayTransactionCount,
    todayTurnover,
  };
};

