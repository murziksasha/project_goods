import mongoose from 'mongoose';
import {
  baseFinanceCurrency,
  Cashbox,
  FinanceCurrencyConfig,
  FinanceTransaction,
  seededFinanceCurrencies,
  type CashboxDocument,
  type FinanceCurrency,
  type FinanceCurrencyConfigDocument,
  type FinanceTransactionDocument,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { formatCashbox, formatCurrencyConfig, formatTransaction } from './formatters';
import {
  normalizeAmount,
  normalizeCurrency,
  normalizeCurrencyCode,
  normalizeDate,
  normalizeEnabledCurrencies,
  normalizeName,
  normalizeType,
  type CashboxPayload,
  type CurrencyPayload,
  type TransactionPayload,
  type UpdateCurrencyPayload,
  type UpdateCashboxPayload,
} from './normalizers';

const defaultCashboxName = 'Основная';

const accountingBusinessTimeZone = 'Europe/Kiev';
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

const getAccountingBusinessDateKey = (
  value: string | Date,
  timeZone = accountingBusinessTimeZone,
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const mapLikeToRecord = <T>(
  value: Map<string, T> | Record<string, T> | undefined,
) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return { ...value };
};

const getMapValue = <T>(
  value: Map<string, T> | Record<string, T> | undefined,
  key: string,
) => {
  if (!value) return undefined;
  if (value instanceof Map) return value.get(key);
  return value[key];
};

const withOptionalFinanceSession = async <T>(
  operation: (session?: mongoose.ClientSession) => Promise<T>,
) => {
  if (mongoose.connection.readyState !== 1) {
    return operation();
  }

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
};

const leanWithOptionalSession = async <T>(
  query: unknown,
  session?: mongoose.ClientSession,
) => {
  const chain = query as {
    session?: (session: mongoose.ClientSession) => unknown;
    lean: () => Promise<T>;
  };
  const withSession = session && chain.session ? chain.session(session) : chain;
  return (withSession as { lean: () => Promise<T> }).lean();
};

const updateWithOptionalSession = async (
  query: unknown,
  session?: mongoose.ClientSession,
) => {
  const chain = query as {
    session?: (session: mongoose.ClientSession) => Promise<unknown>;
    then?: unknown;
  };
  if (session && chain.session) {
    return chain.session(session);
  }
  return query as Promise<unknown>;
};

const buildCurrencyDefaults = (currencyCodes: string[]) =>
  currencyCodes.reduce<{
    balances: Record<string, number>;
    enabledCurrencies: Record<string, boolean>;
  }>(
    (acc, currency) => {
      acc.balances[currency] = 0;
      acc.enabledCurrencies[currency] = currency === baseFinanceCurrency;
      return acc;
    },
    { balances: {}, enabledCurrencies: {} },
  );

const ensureFinanceCurrencies = async (session?: mongoose.ClientSession) => {
  await Promise.all(
    seededFinanceCurrencies.map((code) => {
      const op = FinanceCurrencyConfig.findOneAndUpdate(
        { code },
        {
          $setOnInsert: {
            code,
            isSystem: true,
            isArchived: false,
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      );
      return session && (op as any).session ? (op as any).session(session) : op;
    }),
  );
};

const listCurrencyDocuments = async (options: { includeArchived?: boolean } = {}) => {
  await ensureFinanceCurrencies();
  const query = options.includeArchived ? {} : { isArchived: false };
  return FinanceCurrencyConfig.find(query)
    .sort({ isSystem: -1, code: 1 })
    .lean<FinanceCurrencyConfigDocument[]>();
};

const getCurrencyCodes = async (options: { includeArchived?: boolean } = {}) =>
  (await listCurrencyDocuments(options)).map((currency) => currency.code);

const getCurrencyConfigOrThrow = async (
  code: string,
  session?: mongoose.ClientSession,
) => {
  await ensureFinanceCurrencies(session);
  const currency = await leanWithOptionalSession<FinanceCurrencyConfigDocument | null>(
    FinanceCurrencyConfig.findOne({ code }),
    session,
  );
  if (!currency) {
    throw new Error('Unsupported transaction currency.');
  }
  return currency;
};

export const ensureDefaultCashbox = async (session?: mongoose.ClientSession) => {
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  const currencyDefaults = buildCurrencyDefaults(currencyCodes);
  const cashbox = await leanWithOptionalSession<CashboxDocument | null>(
    Cashbox.findOne({ isDefault: true }),
    session,
  );
  if (cashbox) {
    if (!cashbox.enabledCurrencies) {
      await updateWithOptionalSession(
        Cashbox.findByIdAndUpdate(cashbox._id, {
          $set: { enabledCurrencies: currencyDefaults.enabledCurrencies },
        }),
        session,
      );
      return { ...cashbox, enabledCurrencies: currencyDefaults.enabledCurrencies };
    }
    return cashbox;
  }

  const createdOp = Cashbox.findOneAndUpdate(
    { name: defaultCashboxName },
    {
      $setOnInsert: {
        name: defaultCashboxName,
        balances: currencyDefaults.balances,
        enabledCurrencies: currencyDefaults.enabledCurrencies,
      },
      $set: {
        isDefault: true,
        isArchived: false,
        'enabledCurrencies.UAH': true,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  if (session) (createdOp as any).session?.(session);
  const created = await createdOp.lean<CashboxDocument | null>();

  if (!created) {
    throw new Error('Failed to create default cashbox.');
  }

  return created;
};

const backfillCashboxEnabledCurrencies = async () => {
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  await Cashbox.updateMany(
    { enabledCurrencies: { $exists: false } },
    { $set: { enabledCurrencies: buildCurrencyDefaults(currencyCodes).enabledCurrencies } },
  );
  await Cashbox.updateMany(
    { 'enabledCurrencies.UAH': { $ne: true } },
    { $set: { 'enabledCurrencies.UAH': true } },
  );
  await Promise.all(
    currencyCodes.map((currency) =>
      Promise.all([
        Cashbox.updateMany(
          { [`balances.${currency}`]: { $exists: false } },
          { $set: { [`balances.${currency}`]: 0 } },
        ),
        Cashbox.updateMany(
          { [`enabledCurrencies.${currency}`]: { $exists: false } },
          {
            $set: {
              [`enabledCurrencies.${currency}`]: currency === baseFinanceCurrency,
            },
          },
        ),
      ]),
    ),
  );
};

export const listCashboxes = async (options: { includeArchived?: boolean } = {}) => {
  await ensureDefaultCashbox();
  await backfillCashboxEnabledCurrencies();
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  const query = options.includeArchived ? {} : { isArchived: false };
  const cashboxes = await Cashbox.find(query)
    .sort({ isDefault: -1, createdAt: 1 })
    .lean<CashboxDocument[]>();

  return cashboxes.map((cashbox) => formatCashbox(cashbox, currencyCodes));
};

export const createCashbox = async (payload: CashboxPayload) => {
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  const currencyDefaults = buildCurrencyDefaults(currencyCodes);
  const name = normalizeName(payload.name);
  if (name.length < 2) {
    throw new Error('Cashbox name must contain at least 2 characters.');
  }

  const cashbox = new Cashbox({
    name,
    balances: currencyDefaults.balances,
    enabledCurrencies: currencyDefaults.enabledCurrencies,
  });
  await cashbox.validate();
  await cashbox.save();

  return formatCashbox(cashbox.toObject<CashboxDocument>(), currencyCodes);
};

export const updateCashbox = async (
  cashboxId: string,
  payload: UpdateCashboxPayload,
) => {
  isValidObjectIdOrThrow(cashboxId, 'cashboxId');
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
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
  if (payload.enabledCurrencies !== undefined) {
    const normalized = normalizeEnabledCurrencies(payload.enabledCurrencies);
    const existingEnabled = mapLikeToRecord<boolean>(existing.enabledCurrencies);
    Object.keys(normalized).forEach((currency) => {
      if (!currencyCodes.includes(currency)) {
        throw new Error('Unsupported cashbox currency setting.');
      }
    });
    patch.enabledCurrencies = {
      ...buildCurrencyDefaults(currencyCodes).enabledCurrencies,
      ...existingEnabled,
      ...normalized,
      [baseFinanceCurrency]: true,
    };
  }
  if (Object.keys(patch).length === 0) {
    return formatCashbox(existing, currencyCodes);
  }

  const updated = await Cashbox.findByIdAndUpdate(
    cashboxId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean<CashboxDocument | null>();
  if (!updated) {
    throw new Error('Cashbox not found.');
  }

  return formatCashbox(updated, currencyCodes);
};

export const listFinanceCurrencies = async (options: { includeArchived?: boolean } = {}) => {
  const currencies = await listCurrencyDocuments(options);
  return currencies.map(formatCurrencyConfig);
};

export const createFinanceCurrency = async (payload: CurrencyPayload) => {
  const code = normalizeCurrencyCode(payload.code);
  if (code === baseFinanceCurrency) {
    throw new Error('Currency already exists.');
  }

  return withOptionalFinanceSession(async (session) => {
    await ensureFinanceCurrencies();
    const existing = await leanWithOptionalSession<FinanceCurrencyConfigDocument | null>(
      FinanceCurrencyConfig.findOne({ code }),
      session,
    );
    if (existing && !existing.isArchived) {
      throw new Error('Currency already exists.');
    }

    const currency = existing
      ? await leanWithOptionalSession<FinanceCurrencyConfigDocument | null>(
          FinanceCurrencyConfig.findOneAndUpdate(
            { code },
            { $set: { isArchived: false } },
            { returnDocument: 'after', runValidators: true },
          ),
          session,
        )
      : await leanWithOptionalSession<FinanceCurrencyConfigDocument | null>(
          FinanceCurrencyConfig.findOneAndUpdate(
            { code },
            {
              $setOnInsert: {
                code,
                isSystem: false,
                isArchived: false,
              },
            },
            { upsert: true, returnDocument: 'after', runValidators: true },
          ),
          session,
        );

    await updateWithOptionalSession(
      Cashbox.updateMany(
        { [`balances.${code}`]: { $exists: false } },
        {
          $set: {
            [`balances.${code}`]: 0,
            [`enabledCurrencies.${code}`]: false,
          },
        },
      ),
      session,
    );

    if (!currency) {
      throw new Error('Failed to create currency.');
    }
    return formatCurrencyConfig(currency);
  });
};

export const updateFinanceCurrency = async (
  codePayload: unknown,
  payload: UpdateCurrencyPayload,
) => {
  const code = normalizeCurrencyCode(codePayload);
  if (code === baseFinanceCurrency) {
    throw new Error('UAH currency cannot be archived.');
  }

  const patch: Record<string, unknown> = {};
  if (payload.isArchived !== undefined) {
    patch.isArchived = Boolean(payload.isArchived);
  }
  if (Object.keys(patch).length === 0) {
    const existing = await FinanceCurrencyConfig.findOne({ code })
      .lean<FinanceCurrencyConfigDocument | null>();
    if (!existing) throw new Error('Currency not found.');
    return formatCurrencyConfig(existing);
  }

  const updated = await FinanceCurrencyConfig.findOneAndUpdate(
    { code },
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean<FinanceCurrencyConfigDocument | null>();
  if (!updated) {
    throw new Error('Currency not found.');
  }
  return formatCurrencyConfig(updated);
};

const getCashboxOrThrow = async (
  cashboxId: unknown,
  field: string,
  session?: mongoose.ClientSession,
) => {
  const id = String(cashboxId ?? '');
  isValidObjectIdOrThrow(id, field);
  const cashbox = await leanWithOptionalSession<CashboxDocument | null>(
    Cashbox.findById(id),
    session,
  );
  if (!cashbox || cashbox.isArchived) {
    throw new Error(`${field} cashbox not found.`);
  }

  return cashbox;
};

const applyCashboxDelta = async (
  cashboxId: mongoose.Types.ObjectId | string,
  currency: FinanceCurrency,
  delta: number,
  session?: mongoose.ClientSession,
) => {
  const cashbox = await leanWithOptionalSession<CashboxDocument | null>(
    Cashbox.findById(cashboxId),
    session,
  );
  if (!cashbox) {
    throw new Error('Cashbox not found.');
  }

  const currentBalance = getMapValue(cashbox.balances, currency) ?? 0;
  if (currentBalance + delta < 0) {
    throw new Error('Cashbox balance cannot become negative.');
  }

  if (delta < 0 && typeof Cashbox.updateOne === 'function') {
    const result = (await updateWithOptionalSession(
      Cashbox.updateOne(
        {
          _id: cashboxId,
          [`balances.${currency}`]: { $gte: Math.abs(delta) },
        },
        { $inc: { [`balances.${currency}`]: delta } },
      ),
      session,
    )) as { modifiedCount?: number; matchedCount?: number };
    if ((result.modifiedCount ?? result.matchedCount ?? 0) < 1) {
      throw new Error('Cashbox balance is not enough for this operation.');
    }
    return;
  }

  await updateWithOptionalSession(
    Cashbox.findByIdAndUpdate(cashboxId, {
      $inc: { [`balances.${currency}`]: delta },
    }),
    session,
  );
};

const isCurrencyEnabledForCashbox = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) =>
  currency === baseFinanceCurrency ||
  getMapValue(cashbox.enabledCurrencies, currency) === true;

const assertCashboxCanAcceptCurrency = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) => {
  if (!isCurrencyEnabledForCashbox(cashbox, currency)) {
    throw new Error('Cashbox currency is not enabled for receiving.');
  }
};

const assertCashboxCanWithdrawCurrency = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) => {
  if (
    !isCurrencyEnabledForCashbox(cashbox, currency) &&
    (getMapValue(cashbox.balances, currency) ?? 0) <= 0
  ) {
    throw new Error('Cashbox currency is not available for withdrawal.');
  }
};

export const createFinanceTransaction = async (payload: TransactionPayload) => {
  return withOptionalFinanceSession(async (session) => {
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
        // Unique partial index conflict: another concurrent request created it first.
        // We must revert any deltas applied in this attempt (the insert never succeeded for us).
        // In session case: revert nets to 0 inside this tx before returning success.
        // In no-session (tests): this undoes the pre-apply so balance is correct.
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
  });
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
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });

  const totals = cashboxes.reduce(
    (summary, cashbox) => {
      currencyCodes.forEach((currency) => {
        summary[currency] = (summary[currency] ?? 0) + (cashbox.balances[currency] ?? 0);
      });
      return summary;
    },
    currencyCodes.reduce<Record<string, number>>((acc, currency) => {
      acc[currency] = 0;
      return acc;
    }, {}),
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
        [transaction.currency]: (summary[transaction.currency] ?? 0) + transaction.amount,
      }),
      currencyCodes.reduce<Record<string, number>>((acc, currency) => {
        acc[currency] = 0;
        return acc;
      }, {}),
    ),
  };
};
