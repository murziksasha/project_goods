export type FinanceCurrency = string;
export type FinanceTransactionType = 'deposit' | 'withdraw' | 'transfer';
export type FinanceTransactionStatus = 'active' | 'cancelled';
export const financeTransactionCategories = [
  'client_payment',
  'client_refund',
  'supplier_payment',
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;
export type FinanceTransactionCategory =
  (typeof financeTransactionCategories)[number];
export const manualWithdrawCategories = [
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;
export type ManualWithdrawCategory = (typeof manualWithdrawCategories)[number];

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
  hasCurrencyOperations?: Record<FinanceCurrency, boolean>;
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
  category?: FinanceTransactionCategory;
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
  enabledCurrencies?: Record<FinanceCurrency, boolean>;
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
  category?: FinanceTransactionCategory;
  idempotencyKey?: string;
};

export type ProfitReportPeriod = 'whole' | 'day' | 'week' | 'month' | 'year';
export type ProfitReportSource = 'all' | 'sales' | 'services';

export type ProfitReportParams = {
  period?: ProfitReportPeriod;
  dateFrom?: string;
  dateTo?: string;
  source?: ProfitReportSource;
};

export type ProfitMarginRow = {
  key: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  cost: number;
  revenue: number;
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
};

export type ProfitCashCategoryRow = {
  category: FinanceTransactionCategory;
  amount: number;
  count: number;
};

export type ProfitCashOperation = {
  type: FinanceTransactionType;
  category: FinanceTransactionCategory;
  amount: number;
  currency: FinanceCurrency;
  note: string;
  transactionDate: string;
};

export type ProfitCashBucket = {
  collected: number;
  inventoryPurchases: number;
  opex: number;
  refunds: number;
  net: number;
};

export type FinanceProfitReport = {
  period: {
    key: ProfitReportPeriod | 'custom';
    dateFrom: string | null;
    dateTo: string | null;
    timeZone: string;
  };
  source: ProfitReportSource;
  currency: FinanceCurrency;
  otherCurrencies: string[];
  margin: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number | null;
    unknownCostCount: number;
  };
  cash: {
    collected: number;
    inventoryPurchases: number;
    opex: number;
    refunds: number;
    net: number;
    opexByCategory: ProfitCashCategoryRow[];
    byCurrency?: Record<string, ProfitCashBucket>;
    operations: ProfitCashOperation[];
  };
  rows: ProfitMarginRow[];
  dataScope: 'live_sales_only';
  coldSalesPurgedExist: boolean;
  saleCount: number;
};
