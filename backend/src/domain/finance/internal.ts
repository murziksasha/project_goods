import mongoose from 'mongoose';
import {
  baseFinanceCurrency,
  Cashbox,
  FinanceCurrencyConfig,
  seededFinanceCurrencies,
  type CashboxDocument,
  type FinanceCurrency,
  type FinanceCurrencyConfigDocument,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';

export const accountingBusinessTimeZone = 'Europe/Kiev';

export const getAccountingBusinessDateKey = (
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


export const mapLikeToRecord = <T>(
  value: Map<string, T> | Record<string, T> | undefined,
) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return { ...value };
};


export const getMapValue = <T>(
  value: Map<string, T> | Record<string, T> | undefined,
  key: string,
) => {
  if (!value) return undefined;
  if (value instanceof Map) return value.get(key);
  return value[key];
};


export { withOptionalMongoSession as withOptionalFinanceSession } from '../../shared/lib/mongo-session';


export const leanWithOptionalSession = async <T>(
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


export const updateWithOptionalSession = async (
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


export const buildCurrencyDefaults = (currencyCodes: string[]) =>
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


export const ensureFinanceCurrencies = async (session?: mongoose.ClientSession) => {
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


export const listCurrencyDocuments = async (
  options: { includeArchived?: boolean; session?: mongoose.ClientSession } = {},
) => {
  await ensureFinanceCurrencies(options.session);
  const query = options.includeArchived ? {} : { isArchived: false };
  const findQuery = FinanceCurrencyConfig.find(query).sort({ isSystem: -1, code: 1 });
  if (options.session && findQuery.session) {
    return findQuery.session(options.session).lean<FinanceCurrencyConfigDocument[]>();
  }
  return findQuery.lean<FinanceCurrencyConfigDocument[]>();
};


export const getCurrencyCodes = async (
  options: { includeArchived?: boolean; session?: mongoose.ClientSession } = {},
) => (await listCurrencyDocuments(options)).map((currency) => currency.code);


export const getCurrencyConfigOrThrow = async (
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


export const getCashboxOrThrow = async (
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


export const applyCashboxDelta = async (
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
    throw new HttpError(404, 'Cashbox not found.');
  }

  const currentBalance = getMapValue(cashbox.balances, currency) ?? 0;
  if (currentBalance + delta < 0) {
    throw new HttpError(400, 'Cashbox balance cannot become negative.');
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
      throw new HttpError(400, 'Cashbox balance is not enough for this operation.');
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


export const isCurrencyEnabledForCashbox = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) =>
  currency === baseFinanceCurrency ||
  getMapValue(cashbox.enabledCurrencies, currency) === true;


export const assertCashboxCanAcceptCurrency = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) => {
  if (!isCurrencyEnabledForCashbox(cashbox, currency)) {
    throw new Error('Cashbox currency is not enabled for receiving.');
  }
};


export const assertCashboxCanWithdrawCurrency = (
  cashbox: CashboxDocument,
  currency: FinanceCurrency,
) => {
  if (
    !isCurrencyEnabledForCashbox(cashbox, currency) &&
    (getMapValue(cashbox.balances, currency) ?? 0) <= 0
  ) {
    throw new HttpError(400, 'Cashbox currency is not available for withdrawal.');
  }
};


export const backfillCashboxEnabledCurrencies = async () => {
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

