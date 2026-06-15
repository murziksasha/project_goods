export type FinanceCurrency = string;
export type FinanceTransactionType = 'deposit' | 'withdraw' | 'transfer';
export type FinanceTransactionStatus = 'active' | 'cancelled';

export type Cashbox = {
  id: string;
  name: string;
  balances: Record<FinanceCurrency, number>;
  enabledCurrencies: Record<FinanceCurrency, boolean>;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FinanceTransaction = {
  id: string;
  type: FinanceTransactionType;
  amount: number;
  currency: FinanceCurrency;
  fromCashbox: { id: string; name: string } | null;
  toCashbox: { id: string; name: string } | null;
  note: string;
  transactionDate: string;
  status: FinanceTransactionStatus;
  isCancellation: boolean;
  cancelsTransactionId?: string;
  cancellationTransactionId?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FinanceReport = {
  totals: Record<FinanceCurrency, number>;
  cashboxCount: number;
  transactionCount: number;
  todayTransactionCount: number;
  todayTurnover: Record<FinanceCurrency, number>;
};

export type SupplierOrderPaymentQueueItem = {
  id: string;
  orderBaseId: string;
  number: string;
  supplierName: string;
  deliveryDate: string;
  total: number;
  createdAt: string;
};

export type CreateCashboxPayload = {
  name: string;
};

export type UpdateCashboxPayload = {
  name?: string;
  isArchived?: boolean;
  enabledCurrencies?: Record<FinanceCurrency, boolean>;
};

export type CreateFinanceTransactionPayload = {
  type: FinanceTransactionType;
  amount: string;
  currency: FinanceCurrency;
  fromCashboxId?: string;
  toCashboxId?: string;
  note: string;
};
