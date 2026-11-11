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
export type SystemFinanceTransactionCategory =
  (typeof financeTransactionCategories)[number];
export type FinanceTransactionCategory = string;
export const OTHER_CATEGORY_SLUG = 'other';
export const financeCategoryKinds = [
  'system_auto',
  'system_opex',
  'custom_opex',
] as const;
export type FinanceCategoryKind = (typeof financeCategoryKinds)[number];
export const manualWithdrawCategories = [
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;
export type ManualWithdrawCategory = (typeof manualWithdrawCategories)[number];

export type FinanceCategory = {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  kind: FinanceCategoryKind;
  isActive: boolean;
  sortOrder: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateFinanceCategoryPayload = {
  name: string;
};

export type UpdateFinanceCategoryPayload = {
  isActive?: boolean;
  name?: string;
};

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
  isNonCash: boolean;
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
  category?: string;
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
  isNonCash?: boolean;
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
  category?: string;
  idempotencyKey?: string;
};

export type ProfitReportPeriod = 'whole' | 'day' | 'week' | 'month' | 'year' | 'last30';
export type ProfitReportSource = 'all' | 'sales' | 'services';

export type ProfitReportParams = {
  period?: ProfitReportPeriod;
  dateFrom?: string;
  dateTo?: string;
  source?: ProfitReportSource;
  lossOnly?: boolean;
  missingCostOnly?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export type ProfitMarginRow = {
  key: string;
  name: string;
  type: 'product' | 'service';
  quantity: number;
  cost: number;
  revenue: number;
  knownCostRevenue?: number;
  profit: number;
  marginPct: number | null;
  costKnown: boolean;
  knownCount?: number;
  unknownCount?: number;
  catalogProductId?: string | null;
  serviceId?: string | null;
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

export type ProfitTrendPoint = {
  dateKey: string;
  revenue: number;
  knownCost: number;
  knownProfit: number;
  cashCollected: number;
  cashOutflows: number;
  cashNet: number;
};

export type FinanceProfitMarginTotals = {
  revenue: number;
  cogs: number;
  grossProfit: number | null;
  grossMarginPct: number | null;
  unknownCostCount: number;
  isIncomplete?: boolean;
  knownCostRevenue?: number;
  knownCostCogs?: number;
  knownCostGrossProfit?: number;
  knownCostGrossMarginPct?: number | null;
  costCoveragePct?: number;
};

export type ProfitComparisonSnapshot = {
  period: {
    key: ProfitReportPeriod | 'custom';
    dateFrom: string | null;
    dateTo: string | null;
  };
  margin: FinanceProfitMarginTotals;
  cash: {
    collected: number;
    inventoryPurchases: number;
    opex: number;
    refunds: number;
    net: number;
    byCurrency?: Record<string, ProfitCashBucket>;
  };
  saleCount: number;
};

export type FinanceProfitReport = {
  period: {
    key: ProfitReportPeriod | 'custom';
    dateFrom: string | null;
    dateTo: string | null;
    timeZone: string;
  };
  previousPeriod?: {
    dateFrom: string | null;
    dateTo: string | null;
  } | null;
  source: ProfitReportSource;
  currency: FinanceCurrency;
  otherCurrencies: string[];
  margin: FinanceProfitMarginTotals;
  cash: {
    collected: number;
    inventoryPurchases: number;
    opex: number;
    refunds: number;
    net: number;
    opexByCategory: ProfitCashCategoryRow[];
    byCurrency?: Record<string, ProfitCashBucket>;
    operations: ProfitCashOperation[];
    transfersVolume?: number;
    transfersCount?: number;
  };
  rows: ProfitMarginRow[];
  trendSeries?: ProfitTrendPoint[];
  previousComparison?: ProfitComparisonSnapshot | null;
  dataScope: 'live_sales_only';
  coldSalesPurgedExist: boolean;
  saleCount: number;
  coverage?: {
    coldSalesPurgedExist: boolean;
    isProfitIncomplete: boolean;
    warnings: string[];
  };
};

export type ProfitReportDetailItem = {
  id: string;
  recordNumber: string | null;
  kind: 'sale' | 'repair';
  status: string;
  saleDate: string;
  clientName: string;
  revenue: number;
  knownCostRevenue: number;
  knownCost: number;
  knownProfit: number;
  profit: number | null;
  marginPct: number | null;
  isIncomplete: boolean;
  missingCostCount: number;
  knownCostCount: number;
  isLoss: boolean;
  matchingLineCount: number;
};

export type ProfitReportDetailsResponse = {
  items: ProfitReportDetailItem[];
  total: number;
  page: number;
  pageSize: number;
  totals: {
    revenue: number;
    knownCost: number;
    knownProfit: number;
    missingCostRecordsCount: number;
    lossRecordsCount: number;
  };
};

export type PlannedCashEvent = {
  id: string;
  title: string;
  type: 'inflow' | 'outflow';
  amount: number;
  currency: string;
  scheduledDate: string;
  obligationKind?: 'supplier_order' | 'sale_balance' | null;
  obligationId?: string | null;
};

export type CashboxesReportParams = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  cashboxId?: string;
  currency?: string;
  type?: string;
  category?: string;
  q?: string;
  horizonDays?: 30 | 60 | 90;
  demandMultiplier?: number;
  inflowMultiplier?: number;
  outflowMultiplier?: number;
  inflowTimingShiftDays?: number;
  outflowTimingShiftDays?: number;
  plannedEvents?: PlannedCashEvent[];
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export type CashboxReconciliationRow = {
  cashboxId: string;
  name: string;
  currency: string;
  currentBalance: number;
  openingBalance: number | null;
  closingBalance: number | null;
  inflows: number;
  outflows: number;
  transfersIn: number;
  transfersOut: number;
  reconciliationDelta: number | null;
};

export type CashboxCurrencyReport = {
  currency: string;
  currentBalance: number;
  inflows: number;
  outflows: number;
  netExternalCashflow: number;
  inflowsCount: number;
  outflowsCount: number;
  transfersVolume: number;
  transfersCount: number;
  transfersIn: number;
  transfersOut: number;
  reconciliation: {
    currentBalance: number;
    openingBalance: number | null;
    closingBalance: number | null;
    reconciliationDelta: number | null;
    reconciled: boolean;
    complete: boolean;
    perCashbox: CashboxReconciliationRow[];
  };
  comparison: {
    inflowsPrev: number;
    outflowsPrev: number;
    netExternalCashflowPrev: number;
    inflowsDeltaPct: number | null;
    outflowsDeltaPct: number | null;
  } | null;
  trend: Array<{
    dateKey: string;
    inflows: number;
    outflows: number;
    netExternal: number;
    transfers: number;
  }>;
  forecast: {
    isEstimate: boolean;
    horizonDays: 30 | 60 | 90;
    startingBalance: number;
    avgDailyInflow: number;
    avgDailyOutflow: number;
    adjustedDailyInflow: number;
    adjustedDailyOutflow: number;
    totalProjectedBaselineInflows: number;
    totalProjectedBaselineOutflows: number;
    totalPlannedInflows: number;
    totalPlannedOutflows: number;
    endingProjectedBalance: number;
    lowestProjectedBalance: number;
    series: Array<{
      day: number;
      dateKey: string;
      baselineInflow: number;
      baselineOutflow: number;
      plannedInflow: number;
      plannedOutflow: number;
      projectedBalance: number;
    }>;
  };
};

export type UnscheduledCashObligation = {
  obligationKind: 'supplier_order' | 'sale_balance';
  obligationId: string;
  label: string;
  type: 'inflow' | 'outflow';
  currency: string;
  amount: number;
  dueDate: string | null;
  isScheduled: boolean;
};

export type CashboxesReportResponse = {
  generatedAt: string;
  timeZone: string;
  period: {
    key: string;
    dateFrom: string | null;
    dateTo: string | null;
  };
  previousPeriod: {
    dateFrom: string | null;
    dateTo: string | null;
  } | null;
  currencies: string[];
  allCurrencies: string[];
  cashboxes: Array<{
    id: string;
    name: string;
    balances: Record<string, number>;
    isArchived: boolean;
  }>;
  byCurrency: Record<string, CashboxCurrencyReport>;
  assumptions: {
    horizonDays: 30 | 60 | 90;
    demandMultiplier: number;
    inflowMultiplier: number;
    outflowMultiplier: number;
    inflowTimingShiftDays: number;
    outflowTimingShiftDays: number;
    plannedEvents: PlannedCashEvent[];
  };
  unscheduledObligations: UnscheduledCashObligation[];
  obligationSummary: {
    unscheduledPayablesTotal: number;
    unscheduledReceivablesTotal: number;
    unscheduledCount: number;
    scheduledCount: number;
  };
  coverage: {
    sealedThrough: string | null;
    purgedBeforeSeal: boolean;
    purgedTxCount: number;
    reconciliationUnavailableBySeal: boolean;
    observedHistoryDays: number;
    historyWindowDays: number;
    warnings: string[];
  };
};

export type CashboxesReportDetailItem = {
  id: string;
  type: FinanceTransactionType;
  amount: number;
  currency: string;
  category: string;
  fromCashboxId: string | null;
  fromCashboxName: string | null;
  toCashboxId: string | null;
  toCashboxName: string | null;
  note: string;
  transactionDate: string;
};

export type CashboxesReportDetailsResponse = {
  items: CashboxesReportDetailItem[];
  total: number;
  page: number;
  pageSize: number;
};
