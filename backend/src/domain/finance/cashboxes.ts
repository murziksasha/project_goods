import type mongoose from 'mongoose';
import {
  baseFinanceCurrency,
  Cashbox,
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

const defaultCashboxName = 'Основная';

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
  );
  if (session) (createdOp as any).session?.(session);
  const created = await createdOp.lean<CashboxDocument | null>();

  if (!created) {
    throw new Error('Failed to create default cashbox.');
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

