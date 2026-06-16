import {
  baseFinanceCurrency,
  type CashboxDocument,
  type FinanceCurrencyConfigDocument,
  type FinanceTransactionDocument,
} from './model';

const mapLikeToRecord = <T>(
  value: Map<string, T> | Record<string, T> | undefined,
) => {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return { ...value };
};

export const formatCurrencyConfig = (currency: FinanceCurrencyConfigDocument) => ({
  id: currency._id.toString(),
  code: currency.code,
  isSystem: currency.isSystem,
  isArchived: currency.isArchived,
  createdAt: currency.createdAt.toISOString(),
  updatedAt: currency.updatedAt.toISOString(),
});

export const formatCashbox = (
  cashbox: CashboxDocument,
  currencyCodes: string[] = [],
) => {
  const balances = mapLikeToRecord<number>(cashbox.balances);
  const enabledCurrencies = mapLikeToRecord<boolean>(cashbox.enabledCurrencies);
  const allCurrencyCodes = Array.from(
    new Set([baseFinanceCurrency, 'USD', ...currencyCodes, ...Object.keys(balances)]),
  );

  return {
  id: cashbox._id.toString(),
  name: cashbox.name,
  balances: allCurrencyCodes.reduce<Record<string, number>>((acc, currency) => {
    acc[currency] = balances[currency] ?? 0;
    return acc;
  }, {}),
  enabledCurrencies: allCurrencyCodes.reduce<Record<string, boolean>>(
    (acc, currency) => {
      acc[currency] =
        currency === baseFinanceCurrency || enabledCurrencies[currency] === true;
      return acc;
    },
    {},
  ),
  isDefault: cashbox.isDefault,
  isArchived: cashbox.isArchived,
  createdAt: cashbox.createdAt.toISOString(),
  updatedAt: cashbox.updatedAt.toISOString(),
  };
};

export const formatTransaction = (transaction: FinanceTransactionDocument) => ({
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
  status: transaction.status ?? 'active',
  isCancellation: Boolean(transaction.isCancellation),
  cancelsTransactionId: transaction.cancelsTransaction
    ? transaction.cancelsTransaction.toString()
    : undefined,
  cancellationTransactionId: transaction.cancellationTransaction
    ? transaction.cancellationTransaction.toString()
    : undefined,
  cancelledAt: transaction.cancelledAt
    ? transaction.cancelledAt.toISOString()
    : undefined,
  createdAt: transaction.createdAt.toISOString(),
  updatedAt: transaction.updatedAt.toISOString(),
});
