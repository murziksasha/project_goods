import type { FinanceTransactionDocument } from './model';

type BalanceAfterCashbox = {
  id: string;
  balances: Record<string, number>;
};

type BalanceAfterInput = {
  cashboxes: BalanceAfterCashbox[];
  transactions: FinanceTransactionDocument[];
};

const getTransactionId = (transaction: FinanceTransactionDocument) =>
  transaction._id.toString();

const getCashboxId = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    return value.toString();
  }
  return String(value);
};

export const computeBalanceAfterByTransactionId = ({
  cashboxes,
  transactions,
}: BalanceAfterInput) => {
  const balancesByCashboxCurrency = new Map<string, number>();
  const allCurrencyCodes = Array.from(
    new Set([
      'UAH',
      'USD',
      ...cashboxes.flatMap((cashbox) => Object.keys(cashbox.balances)),
      ...transactions.map((transaction) => transaction.currency),
    ]),
  );

  cashboxes.forEach((cashbox) => {
    allCurrencyCodes.forEach((currency) => {
      balancesByCashboxCurrency.set(
        `${cashbox.id}:${currency}`,
        cashbox.balances[currency] ?? 0,
      );
    });
  });

  const chronologicalDesc = [...transactions].sort((first, second) => {
    const byDate = second.transactionDate.getTime() - first.transactionDate.getTime();
    if (byDate !== 0) return byDate;
    return second.createdAt.getTime() - first.createdAt.getTime();
  });

  const result: Record<string, number | null> = {};

  chronologicalDesc.forEach((transaction) => {
    const fromKey = transaction.fromCashbox
      ? `${getCashboxId(transaction.fromCashbox)}:${transaction.currency}`
      : '';
    const toKey = transaction.toCashbox
      ? `${getCashboxId(transaction.toCashbox)}:${transaction.currency}`
      : '';

    const senderBalanceAfter =
      fromKey.length > 0
        ? (balancesByCashboxCurrency.get(fromKey) ?? 0)
        : null;
    const recipientBalanceAfter =
      toKey.length > 0
        ? (balancesByCashboxCurrency.get(toKey) ?? 0)
        : null;

    if (transaction.type === 'deposit') {
      result[getTransactionId(transaction)] = recipientBalanceAfter;
    } else {
      result[getTransactionId(transaction)] = senderBalanceAfter;
    }

    if (transaction.fromCashbox) {
      balancesByCashboxCurrency.set(
        fromKey,
        (senderBalanceAfter ?? 0) + transaction.amount,
      );
    }

    if (transaction.toCashbox) {
      balancesByCashboxCurrency.set(
        toKey,
        (recipientBalanceAfter ?? 0) - transaction.amount,
      );
    }
  });

  return result;
};