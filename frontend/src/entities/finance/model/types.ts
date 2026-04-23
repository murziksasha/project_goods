export type FinanceCurrency = 'UAH' | 'USD';
export type FinanceTransactionType = 'deposit' | 'withdraw' | 'transfer';

export type Cashbox = {
  id: string;
  name: string;
  balances: Record<FinanceCurrency, number>;
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

export type CreateCashboxPayload = {
  name: string;
};

export type CreateFinanceTransactionPayload = {
  type: FinanceTransactionType;
  amount: string;
  currency: FinanceCurrency;
  fromCashboxId?: string;
  toCashboxId?: string;
  note: string;
};
