import type mongoose from 'mongoose';
import {
  baseFinanceCurrency,
  Cashbox,
  FinanceTransaction,
  type CashboxDocument,
} from './model';
import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { formatCashbox } from './formatters';
import {
  normalizeEnabledCurrencies,
  normalizeName,
  type CashboxPayload,
  type UpdateCashboxPayload,
} from './normalizers';
import {
  backfillCashboxEnabledCurrencies,
  buildCurrencyDefaults,
  getCurrencyCodes,
  leanWithOptionalSession,
  mapLikeToRecord,
  updateWithOptionalSession,
} from './internal';
import { HttpError } from '../../shared/lib/errors';

const defaultCashboxName = 'Основная';
const cannotDisableCurrencyWithActivityMessage =
  'Cannot disable a cashbox currency that has operations or a positive balance.';

type CurrencyOperationRow = {
  currency: string;
  fromCashbox?: mongoose.Types.ObjectId | string | null;
  toCashbox?: mongoose.Types.ObjectId | string | null;
};

const listCurrencyOperationsByCashbox = async (
  cashboxIds?: string[],
): Promise<Record<string, Record<string, boolean>>> => {
  if (cashboxIds && cashboxIds.length === 0) return {};
  const query: Record<string, unknown> = {};
  if (cashboxIds && cashboxIds.length > 0) {
    query.$or = [
      { fromCashbox: { $in: cashboxIds } },
      { toCashbox: { $in: cashboxIds } },
    ];
  }
  const rows = await FinanceTransaction.find(query)
    .select({ currency: 1, fromCashbox: 1, toCashbox: 1 })
    .lean<CurrencyOperationRow[]>();
  const allowedIds = cashboxIds && cashboxIds.length > 0 ? new Set(cashboxIds) : null;
  const result: Record<string, Record<string, boolean>> = {};
  const mark = (cashboxId: unknown, currency: string) => {
    if (!cashboxId || !currency) return;
    const id = String(cashboxId);
    if (allowedIds && !allowedIds.has(id)) return;
    if (!result[id]) result[id] = {};
    result[id][currency] = true;
  };
  rows.forEach((row) => {
    mark(row.fromCashbox, row.currency);
    mark(row.toCashbox, row.currency);
  });
  return result;
};

const assertCanDisableCashboxCurrencies = async (
  cashboxId: string,
  existing: CashboxDocument,
  mergedEnabled: Record<string, boolean>,
) => {
  const existingEnabled = mapLikeToRecord<boolean>(existing.enabledCurrencies);
  const existingBalances = mapLikeToRecord<number>(existing.balances);
  const disabling = Object.keys(mergedEnabled).filter(
    (currency) => existingEnabled[currency] === true && mergedEnabled[currency] !== true,
  );
  if (disabling.length === 0) return;
  const operations = await listCurrencyOperationsByCashbox([cashboxId]);
  const used = operations[cashboxId] ?? {};
  disabling.forEach((currency) => {
    if ((existingBalances[currency] ?? 0) > 0 || used[currency] === true) {
      throw new HttpError(400, cannotDisableCurrencyWithActivityMessage);
    }
  });
};

export const ensureDefaultCashbox = async (session?: mongoose.ClientSession) => {
  const currencyCodes = await getCurrencyCodes({ includeArchived: true, session });
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
  ) as mongoose.Query<CashboxDocument | null, CashboxDocument>;

  if (session) {
    createdOp.session(session);
  }

  const created = await createdOp.lean<CashboxDocument | null>();

  if (!created) {
    throw new HttpError(500, 'Failed to create default cashbox.');
  }

  return created;
};


export const listCashboxes = async (options: { includeArchived?: boolean } = {}) => {
  await ensureDefaultCashbox();
  await backfillCashboxEnabledCurrencies();
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  const query = options.includeArchived ? {} : { isArchived: false };
  const cashboxes = await Cashbox.find(query)
    .sort({ isDefault: -1, createdAt: 1 })
    .lean<CashboxDocument[]>();
  const operationsByCashbox = await listCurrencyOperationsByCashbox(
    cashboxes.map((cashbox) => cashbox._id.toString()),
  );

  return cashboxes.map((cashbox) =>
    formatCashbox(
      cashbox,
      currencyCodes,
      operationsByCashbox[cashbox._id.toString()],
    ),
  );
};


export const createCashbox = async (payload: CashboxPayload) => {
  const currencyCodes = await getCurrencyCodes({ includeArchived: true });
  const currencyDefaults = buildCurrencyDefaults(currencyCodes);
  const name = normalizeName(payload.name);
  if (name.length < 2) {
    throw new HttpError(400, 'Cashbox name must contain at least 2 characters.');
  }

  const enabledCurrencies =
    payload.enabledCurrencies === undefined
      ? currencyDefaults.enabledCurrencies
      : {
          ...currencyDefaults.enabledCurrencies,
          ...normalizeEnabledCurrencies(payload.enabledCurrencies),
        };
  const cashbox = new Cashbox({
    name,
    balances: currencyDefaults.balances,
    enabledCurrencies,
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
    throw new HttpError(404, 'Cashbox not found.');
  }

  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    const nextName = normalizeName(payload.name);
    if (nextName.length < 2) {
      throw new HttpError(400, 'Cashbox name must contain at least 2 characters.');
    }
    patch.name = nextName;
  }
  if (payload.isArchived !== undefined) {
    const nextArchived = Boolean(payload.isArchived);
    if (existing.isDefault && nextArchived) {
      throw new HttpError(400, 'Default cashbox cannot be deactivated.');
    }
    patch.isArchived = nextArchived;
  }
  if (payload.enabledCurrencies !== undefined) {
    const normalized = normalizeEnabledCurrencies(payload.enabledCurrencies);
    const existingEnabled = mapLikeToRecord<boolean>(existing.enabledCurrencies);
    Object.keys(normalized).forEach((currency) => {
      if (!currencyCodes.includes(currency)) {
        throw new HttpError(400, 'Unsupported cashbox currency setting.');
      }
    });
    const merged = {
      ...buildCurrencyDefaults(currencyCodes).enabledCurrencies,
      ...existingEnabled,
      ...normalized,
    };
    if (existing.isDefault && merged[baseFinanceCurrency] !== true) {
      throw new HttpError(400, 'Default cashbox cannot disable UAH.');
    }
    if (!Object.values(merged).some(Boolean)) {
      throw new HttpError(400, 'At least one cashbox currency must be enabled.');
    }
    await assertCanDisableCashboxCurrencies(cashboxId, existing, merged);
    patch.enabledCurrencies = merged;
  }
  if (Object.keys(patch).length === 0) {
    const operations = await listCurrencyOperationsByCashbox([cashboxId]);
    return formatCashbox(existing, currencyCodes, operations[cashboxId]);
  }

  const updated = await Cashbox.findByIdAndUpdate(
    cashboxId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean<CashboxDocument | null>();
  if (!updated) {
    throw new HttpError(404, 'Cashbox not found.');
  }

  const operations = await listCurrencyOperationsByCashbox([cashboxId]);
  return formatCashbox(updated, currencyCodes, operations[cashboxId]);
};

