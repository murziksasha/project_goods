import type { CashboxDocument, FinanceTransactionDocument } from './model';

export const formatCashbox = (cashbox: CashboxDocument) => ({
  id: cashbox._id.toString(),
  name: cashbox.name,
  balances: {
    UAH: cashbox.balances?.UAH ?? 0,
    USD: cashbox.balances?.USD ?? 0,
  },
  enabledCurrencies: {
    UAH: true,
    USD: cashbox.enabledCurrencies?.USD === true,
  },
  isDefault: cashbox.isDefault,
  isArchived: cashbox.isArchived,
  createdAt: cashbox.createdAt.toISOString(),
  updatedAt: cashbox.updatedAt.toISOString(),
});

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
