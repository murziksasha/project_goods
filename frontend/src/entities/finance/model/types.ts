export type FinanceCurrency = string;
export type FinanceTransactionType = 'deposit' | 'withdraw' | 'transfer';
export type FinanceTransactionStatus = 'active' | 'cancelled';

export type FinanceCurrencyConfig = {
  id: string;
  code: FinanceCurrency;
  isSystem: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

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
  balanceAfter?: number | null;
};

export type FinanceTransactionSortField =
  | 'date'
  | 'type'
  | 'amount'
  | 'currency'
  | 'from'
  | 'to';

export type FinanceTransactionsListParams = {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  type?: FinanceTransactionType;
  currency?: string;
  fromCashboxId?: string;
  toCashboxId?: string;
  cashboxId?: string;
  note?: string;
  sortBy?: FinanceTransactionSortField;
  sortDirection?: 'asc' | 'desc';
};

export type FinanceTransactionsPage = {
  items: FinanceTransaction[];
  total: number;
  page: number;
  pageSize: number;
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

export type CreateFinanceCurrencyPayload = {
  code: string;
};

export type UpdateFinanceCurrencyPayload = {
  isArchived?: boolean;
};

export type UpdateCashboxPayload = {
  name?: string;
  isArchived?: boolean;
  enabledCurrencies?: Record<FinanceCurrency, boolean>;
};

export type UpdateFinanceTransactionPayload = {
  note: string;
};

export type CreateFinanceTransactionPayload = {
  type: FinanceTransactionType;
  amount: string;
  currency: FinanceCurrency;
  fromCashboxId?: string;
  toCashboxId?: string;
  note: string;
  idempotencyKey?: string;
};
