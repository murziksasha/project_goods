import {
  baseFinanceCurrency,
  Cashbox,
  FinanceCurrencyConfig,
  type FinanceCurrencyConfigDocument,
} from './model';
import { formatCurrencyConfig } from './formatters';
import {
  normalizeCurrencyCode,
  type CurrencyPayload,
  type UpdateCurrencyPayload,
} from './normalizers';
import {
  ensureFinanceCurrencies,
  leanWithOptionalSession,
  listCurrencyDocuments,
  updateWithOptionalSession,
  withOptionalFinanceSession,
} from './internal';

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

