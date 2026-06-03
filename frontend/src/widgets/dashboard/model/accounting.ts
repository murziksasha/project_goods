import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceTransactionType,
} from '../../../entities/finance/model/types';
import { formatDateTime } from '../../../shared/lib/format';

export type AccountingTab = 'cashboxes' | 'transactions' | 'orders' | 'reports';

export const accountingTabStorageKey = 'project-goods.accounting-tab';
export const accountingSettingsOpenStorageKey = 'project-goods.accounting-settings-open';
export const accountingExpandedFinanceSettingsCardStorageKey =
  'project-goods.accounting-expanded-finance-settings-card';
export const accountingCashboxOrderStorageKey = 'project-goods.accounting-cashbox-order';
export const accountingCurrenciesStorageKey = 'project-goods.accounting-currencies';
export const accountingCurrencyActivityStorageKey = 'project-goods.accounting-currency-activity';
export const accountingCashboxCurrencyActivityStorageKey =
  'project-goods.accounting-cashbox-currency-activity';
export const accountingLastTargetCashboxByTypeStorageKey =
  'project-goods.accounting-last-target-cashbox-by-type';
export const accountingFinanceSettingsTabStorageKey =
  'project-goods.accounting-finance-settings-tab';

export const currencyOptions: FinanceCurrency[] = ['UAH', 'USD'];
export const transactionLabels: Record<FinanceTransactionType, string> = {
  withdraw: 'Withdraw',
  deposit: 'Deposit',
  transfer: 'Transfer',
};

export const formatMoney = (value: number, currency: string) =>
  `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;

export const formatDateDdMmYyyy = (value: string) => {
  if (!value) return '-';
  const normalized = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return formatDateTime(value);
  }
  const [year, month, day] = normalized.split('-');
  return `${day}.${month}.${year}`;
};

export const formatPercent = (value: number) => `${Math.round(value)}%`;

export const formatCurrencyTotals = (totalsByCurrency: Record<string, number>) => {
  const rows = Object.entries(totalsByCurrency).filter(([, amount]) => amount !== 0);
  if (rows.length === 0) return formatMoney(0, 'UAH');
  return rows.map(([currency, amount]) => formatMoney(amount, currency)).join(' / ');
};

export const getLocalDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const truncateLabel = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
};

export const formatTransactionDayLabel = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateDdMmYyyy(value);
  const label = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return label.slice(0, 1).toUpperCase() + label.slice(1);
};

export const initialTransactionForm: CreateFinanceTransactionPayload = {
  type: 'deposit',
  amount: '',
  currency: 'UAH',
  fromCashboxId: '',
  toCashboxId: '',
  note: '',
};

export type TransactionTargetMemory = Partial<Record<'deposit' | 'transfer', string>>;

export type TransactionFilters = {
  type: '' | FinanceTransactionType;
  currency: '' | FinanceCurrency;
  fromCashboxId: string;
  toCashboxId: string;
  note: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'date' | 'type' | 'amount' | 'currency' | 'from' | 'to';
  sortDirection: 'asc' | 'desc';
};

export const initialTransactionFilters: TransactionFilters = {
  type: '',
  currency: '',
  fromCashboxId: '',
  toCashboxId: '',
  note: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'date',
  sortDirection: 'desc',
};

export const applyCashboxOrder = (items: Cashbox[], orderedIds: string[]) => {
  if (orderedIds.length === 0) return items;
  const byId = new Map(items.map((cashbox) => [cashbox.id, cashbox]));
  const ordered = orderedIds
    .map((id) => byId.get(id))
    .filter((cashbox): cashbox is Cashbox => Boolean(cashbox));
  const unordered = items.filter((cashbox) => !orderedIds.includes(cashbox.id));
  return [...ordered, ...unordered];
};

export const isAccountingTab = (value: string | null): value is AccountingTab =>
  value === 'cashboxes' ||
  value === 'transactions' ||
  value === 'orders' ||
  value === 'reports';

export const getAccountingTabFromUrl = (): AccountingTab | null => {
  try {
    const tab = new URLSearchParams(window.location.search).get('accountingTab');
    return isAccountingTab(tab) ? tab : null;
  } catch {
    return null;
  }
};

export const getStoredAccountingTab = (): AccountingTab => {
  try {
    const storedTab = window.localStorage.getItem(accountingTabStorageKey);
    return isAccountingTab(storedTab) ? storedTab : 'cashboxes';
  } catch {
    return 'cashboxes';
  }
};

export const getStoredAccountingSettingsOpen = (): boolean => {
  try {
    return window.localStorage.getItem(accountingSettingsOpenStorageKey) === 'true';
  } catch {
    return false;
  }
};

export const getStoredExpandedFinanceSettingsCard = (): string | null => {
  try {
    return window.localStorage.getItem(accountingExpandedFinanceSettingsCardStorageKey);
  } catch {
    return null;
  }
};
