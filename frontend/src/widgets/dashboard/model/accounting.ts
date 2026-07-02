import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrency,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
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
export const accountingLastOperationByCashboxStorageKey =
  'project-goods.accounting-last-operation-by-cashbox';
export const accountingFinanceSettingsTabStorageKey =
  'project-goods.accounting-finance-settings-tab';

export const currencyOptions: FinanceCurrency[] = ['UAH', 'USD'];
export const accountingBusinessTimeZone = 'Europe/Kiev';
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

export const getAccountingBusinessDateKey = (
  value: string | Date,
  timeZone = accountingBusinessTimeZone,
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

const ORDER_TOKEN_CAPTURE = '([\\p{L}\\p{N}-]+)';
const ORDER_TOKEN_PATTERNS = [
  new RegExp(`Payment for order\\s+${ORDER_TOKEN_CAPTURE}`, 'iu'),
  new RegExp(`Refund for order\\s+${ORDER_TOKEN_CAPTURE}`, 'iu'),
  new RegExp(`Оплата (?:за )?замовлення\\s+${ORDER_TOKEN_CAPTURE}`, 'iu'),
  new RegExp(`Supplier order payment:\\s*(.+)`, 'i'),
];

export const ORDER_LINKED_NOTE_PATTERNS = [
  /Payment for order\s+/i,
  /Refund for order\s+/i,
  /Оплата (?:за )?замовлення\s+/i,
  /^Supplier order payment:/i,
];

export const parseTransactionOrderToken = (note: string | null | undefined): string | null => {
  if (!note) return null;
  const trimmed = note.trim();
  for (const pattern of ORDER_TOKEN_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
};

export const isAccountingOrderLinkedNote = (
  note: string | null | undefined,
): boolean => {
  if (!note) return false;
  const trimmed = note.trim();
  return (
    parseTransactionOrderToken(trimmed) !== null ||
    ORDER_LINKED_NOTE_PATTERNS.some((pattern) => pattern.test(trimmed))
  );
};

export const normalizeTransactionOrderToken = (token: string) => {
  const normalized = token.trim().toLowerCase();
  const withoutItemSuffix = normalized.replace(/-\d+$/, '');
  return withoutItemSuffix || normalized;
};

const supplierOrderTokenMatches = (
  order: Pick<SupplierOrder, 'number' | 'orderBaseId' | 'id'>,
  normalizedToken: string,
) => {
  const candidates = [order.number, order.orderBaseId, order.id]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean);
  return candidates.some(
    (candidate) =>
      candidate === normalizedToken ||
      normalizeTransactionOrderToken(candidate) === normalizedToken,
  );
};

export const findSupplierOrderByTransactionToken = (
  token: string,
  supplierOrders: SupplierOrder[],
): SupplierOrder | undefined => {
  const normalizedToken = normalizeTransactionOrderToken(token);
  if (!normalizedToken) return undefined;
  return supplierOrders.find((order) =>
    supplierOrderTokenMatches(order, normalizedToken),
  );
};

export type TransactionNoteLinkResolution =
  | { kind: 'sale'; sale: Sale }
  | { kind: 'supplier'; supplierOrder: SupplierOrder }
  | { kind: 'linked' }
  | { kind: 'manual' };

export const resolveTransactionNoteLink = ({
  note,
  sales,
  supplierOrders,
}: {
  note: string | null | undefined;
  sales: Sale[];
  supplierOrders: SupplierOrder[];
}): TransactionNoteLinkResolution => {
  const token = parseTransactionOrderToken(note);
  if (token) {
    const normalizedToken = normalizeTransactionOrderToken(token);
    const matchedSale = sales.find(
      (sale) =>
        normalizeTransactionOrderToken(sale.recordNumber ?? '') === normalizedToken ||
        normalizeTransactionOrderToken(sale.id) === normalizedToken,
    );
    if (matchedSale) {
      return { kind: 'sale', sale: matchedSale };
    }

    const matchedOrder = findSupplierOrderByTransactionToken(
      token,
      supplierOrders,
    );
    if (matchedOrder) {
      return { kind: 'supplier', supplierOrder: matchedOrder };
    }

    if (isAccountingOrderLinkedNote(note)) {
      return { kind: 'linked' };
    }
  }

  if (note?.trim()) {
    return { kind: 'manual' };
  }

  return { kind: 'manual' };
};

export const canCancelAccountingTransaction = ({
  canCreateDeposit,
  canCreateWithdraw,
  canCreateTransfer,
  now = new Date(),
  transaction,
}: {
  canCreateDeposit: boolean;
  canCreateWithdraw: boolean;
  canCreateTransfer: boolean;
  now?: Date;
  transaction: FinanceTransaction;
}) => {
  const hasPermission =
    (transaction.type === 'deposit' && canCreateDeposit) ||
    (transaction.type === 'withdraw' && canCreateWithdraw) ||
    (transaction.type === 'transfer' && canCreateTransfer);
  const hasRequiredCashboxes =
    (transaction.type === 'deposit' && Boolean(transaction.toCashbox)) ||
    (transaction.type === 'withdraw' && Boolean(transaction.fromCashbox)) ||
    (transaction.type === 'transfer' &&
      Boolean(transaction.fromCashbox && transaction.toCashbox));

  return (
    hasPermission &&
    hasRequiredCashboxes &&
    !isAccountingOrderLinkedNote(transaction.note) &&
    (transaction.status ?? 'active') !== 'cancelled' &&
    !transaction.isCancellation &&
    !transaction.cancelsTransactionId &&
    getAccountingBusinessDateKey(transaction.transactionDate) ===
      getAccountingBusinessDateKey(now)
  );
};

/** @deprecated Use canCancelAccountingTransaction */
export const canCancelAccountingTransferTransaction = ({
  canCreateTransfer,
  now = new Date(),
  transaction,
}: {
  canCreateTransfer: boolean;
  now?: Date;
  transaction: FinanceTransaction;
}) =>
  canCancelAccountingTransaction({
    canCreateDeposit: false,
    canCreateWithdraw: false,
    canCreateTransfer,
    now,
    transaction,
  });

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

export type CashboxOperationSnapshot = {
  fromCashboxId: string;
  toCashboxId: string;
  currency: FinanceCurrency;
};

export type LastOperationByCashbox = Record<
  string,
  Partial<Record<FinanceTransactionType, CashboxOperationSnapshot>>
>;

export const getCashboxOperationAnchorId = (
  type: FinanceTransactionType,
  fromCashboxId: string,
  toCashboxId: string,
): string => {
  if (type === 'deposit') return toCashboxId;
  return fromCashboxId;
};

export const buildCashboxOperationMemoryEntry = (
  type: FinanceTransactionType,
  form: Pick<CreateFinanceTransactionPayload, 'fromCashboxId' | 'toCashboxId' | 'currency'>,
): { anchorId: string; snapshot: CashboxOperationSnapshot } | null => {
  const fromCashboxId = form.fromCashboxId ?? '';
  const toCashboxId = form.toCashboxId ?? '';
  const anchorId = getCashboxOperationAnchorId(type, fromCashboxId, toCashboxId);
  if (!anchorId) return null;
  return {
    anchorId,
    snapshot: {
      fromCashboxId,
      toCashboxId,
      currency: form.currency,
    },
  };
};

export const upsertLastOperationByCashbox = (
  memory: LastOperationByCashbox,
  type: FinanceTransactionType,
  form: Pick<CreateFinanceTransactionPayload, 'fromCashboxId' | 'toCashboxId' | 'currency'>,
): LastOperationByCashbox => {
  const entry = buildCashboxOperationMemoryEntry(type, form);
  if (!entry) return memory;
  return {
    ...memory,
    [entry.anchorId]: {
      ...memory[entry.anchorId],
      [type]: entry.snapshot,
    },
  };
};

export const parseStoredLastOperationByCashbox = (
  raw: string | null,
): LastOperationByCashbox => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    const next: LastOperationByCashbox = {};
    for (const [cashboxId, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue;
      const byType = value as Record<string, unknown>;
      const snapshotByType: Partial<
        Record<FinanceTransactionType, CashboxOperationSnapshot>
      > = {};
      for (const type of ['deposit', 'withdraw', 'transfer'] as FinanceTransactionType[]) {
        const snapshot = byType[type];
        if (!snapshot || typeof snapshot !== 'object') continue;
        const record = snapshot as Record<string, unknown>;
        if (
          typeof record.fromCashboxId !== 'string' ||
          typeof record.toCashboxId !== 'string' ||
          typeof record.currency !== 'string'
        ) {
          continue;
        }
        snapshotByType[type] = {
          fromCashboxId: record.fromCashboxId,
          toCashboxId: record.toCashboxId,
          currency: record.currency as FinanceCurrency,
        };
      }
      if (Object.keys(snapshotByType).length > 0) {
        next[cashboxId] = snapshotByType;
      }
    }
    return next;
  } catch {
    return {};
  }
};

export const migrateLastTargetCashboxToOperationMemory = (
  legacy: TransactionTargetMemory,
  cashboxes: Cashbox[],
): LastOperationByCashbox => {
  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId =
    cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';
  const next: LastOperationByCashbox = {};
  if (legacy.deposit && cashboxes.some((cashbox) => cashbox.id === legacy.deposit)) {
    next[legacy.deposit] = {
      deposit: {
        fromCashboxId: '',
        toCashboxId: legacy.deposit,
        currency: 'UAH',
      },
    };
  }
  if (legacy.transfer && cashboxes.some((cashbox) => cashbox.id === legacy.transfer)) {
    const fromCashboxId =
      cashboxes.find((cashbox) => cashbox.id !== legacy.transfer)?.id ?? firstCashboxId;
    next[fromCashboxId] = {
      ...next[fromCashboxId],
      transfer: {
        fromCashboxId,
        toCashboxId: legacy.transfer,
        currency: 'UAH',
      },
    };
  }
  void secondCashboxId;
  return next;
};

export const resolveCashboxOperationForm = ({
  type,
  cashboxId,
  cashboxes,
  memory,
  secondCashboxId,
}: {
  type: FinanceTransactionType;
  cashboxId: string;
  cashboxes: Cashbox[];
  memory: LastOperationByCashbox;
  secondCashboxId: string;
}): Pick<CreateFinanceTransactionPayload, 'type' | 'fromCashboxId' | 'toCashboxId' | 'currency'> => {
  const has = (id: string) => Boolean(id) && cashboxes.some((cashbox) => cashbox.id === id);
  const remembered = memory[cashboxId]?.[type];
  if (remembered) {
    const fromCashboxId =
      type === 'deposit' ? '' : remembered.fromCashboxId || cashboxId;
    const toCashboxId =
      type === 'withdraw'
        ? ''
        : remembered.toCashboxId ||
          (type === 'deposit' ? cashboxId : secondCashboxId);
    const fromValid = type === 'deposit' || has(fromCashboxId);
    const toValid = type === 'withdraw' || has(toCashboxId);
    if (fromValid && toValid) {
      return {
        type,
        fromCashboxId,
        toCashboxId,
        currency: remembered.currency,
      };
    }
  }

  const nextFromCashboxId =
    type === 'withdraw' || type === 'transfer' ? cashboxId : '';
  let nextToCashboxId = '';
  if (type === 'deposit') {
    nextToCashboxId = cashboxId;
  } else if (type === 'transfer') {
    nextToCashboxId =
      secondCashboxId && secondCashboxId !== cashboxId
        ? secondCashboxId
        : (cashboxes.find((cashbox) => cashbox.id !== cashboxId)?.id ?? '');
  }

  return {
    type,
    fromCashboxId: nextFromCashboxId,
    toCashboxId: nextToCashboxId,
    currency: 'UAH',
  };
};

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

export type CashboxCurrencyRow = {
  currency: string;
  balance: number;
  canAccept: boolean;
  canWithdraw: boolean;
};

export type FinanceOverview = {
  currencyRows: Array<{
    currency: string;
    total: number;
    todayTurnover: number;
    cashboxes: Array<{
      id: string;
      name: string;
      balance: number;
    }>;
  }>;
  todayByType: Record<FinanceTransactionType, Record<string, number>>;
  pendingSupplierTotal: number;
  pendingSupplierCount: number;
  recentTransactions: FinanceTransaction[];
  activeCashboxCount: number;
  archivedCashboxCount: number;
  transactionCount: number;
  todayTransactionCount: number;
};

type CurrencyBalanceGetter = (cashbox: Cashbox, currencyCode: string) => number;

export const getAccountingTotals = (cashboxes: Cashbox[]) =>
  cashboxes.reduce<Record<string, number>>((summary, cashbox) => {
    Object.entries(cashbox.balances).forEach(([currency, balance]) => {
      summary[currency] = (summary[currency] ?? 0) + balance;
    });
    if (summary.UAH === undefined) summary.UAH = 0;
    return summary;
  }, {});

export const getAccountingCashboxCurrencyRows = ({
  allCurrencyCodes,
  cashbox,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
}: {
  allCurrencyCodes: string[];
  cashbox: Cashbox;
  getCurrencyBalance: CurrencyBalanceGetter;
  isCashboxCurrencyActive: (cashboxId: string, currencyCode: string) => boolean;
  isGlobalCurrencyActive: (currencyCode: string) => boolean;
}): CashboxCurrencyRow[] =>
  allCurrencyCodes
    .map((currencyCode) => {
      const balance = getCurrencyBalance(cashbox, currencyCode);
      const canAccept =
        isGlobalCurrencyActive(currencyCode) &&
        isCashboxCurrencyActive(cashbox.id, currencyCode);
      const canWithdraw = canAccept || balance > 0;
      return {
        currency: currencyCode,
        balance,
        canAccept,
        canWithdraw,
      };
    })
    .filter((item) => item.canWithdraw);

export const getFinanceOverview = ({
  allCashboxes,
  allCurrencyCodes,
  cashboxes,
  getCurrencyBalance,
  isGlobalCurrencyActive,
  report,
  supplierOrdersQueue,
  transactions,
}: {
  allCashboxes: Cashbox[];
  allCurrencyCodes: string[];
  cashboxes: Cashbox[];
  getCurrencyBalance: CurrencyBalanceGetter;
  isGlobalCurrencyActive: (currencyCode: string) => boolean;
  report: FinanceReport | null;
  supplierOrdersQueue: SupplierOrderPaymentQueueItem[];
  transactions: FinanceTransaction[];
}): FinanceOverview => {
  const todayKey = getLocalDateKey(new Date());
  const currencyRows = allCurrencyCodes
    .map((currency) => {
      const total =
        report?.totals[currency] ??
        cashboxes.reduce(
          (sum, cashbox) => sum + getCurrencyBalance(cashbox, currency),
          0,
        );
      const todayTurnover = report?.todayTurnover[currency] ?? 0;

      return {
        currency,
        total,
        todayTurnover,
        cashboxes: cashboxes
          .map((cashbox) => ({
            id: cashbox.id,
            name: cashbox.name,
            balance: getCurrencyBalance(cashbox, currency),
          }))
          .filter((item) => item.balance !== 0 || currency === 'UAH'),
      };
    })
    .filter(
      (row) =>
        row.total !== 0 ||
        row.todayTurnover !== 0 ||
        isGlobalCurrencyActive(row.currency),
    );

  const todayTransactions = transactions.filter(
    (transaction) => getLocalDateKey(transaction.transactionDate) === todayKey,
  );
  const todayByType = todayTransactions.reduce<
    Record<FinanceTransactionType, Record<string, number>>
  >(
    (acc, transaction) => {
      acc[transaction.type][transaction.currency] =
        (acc[transaction.type][transaction.currency] ?? 0) + transaction.amount;
      return acc;
    },
    { deposit: {}, withdraw: {}, transfer: {} },
  );
  const pendingSupplierTotal = supplierOrdersQueue.reduce(
    (sum, order) => sum + order.total,
    0,
  );
  const recentTransactions = [...transactions]
    .sort(
      (left, right) =>
        new Date(right.transactionDate).getTime() -
        new Date(left.transactionDate).getTime(),
    )
    .slice(0, 6);

  return {
    currencyRows,
    todayByType,
    pendingSupplierTotal,
    pendingSupplierCount: supplierOrdersQueue.length,
    recentTransactions,
    activeCashboxCount: cashboxes.length,
    archivedCashboxCount: allCashboxes.filter((cashbox) => cashbox.isArchived)
      .length,
    transactionCount: report?.transactionCount ?? transactions.length,
    todayTransactionCount:
      report?.todayTransactionCount ?? todayTransactions.length,
  };
};

export const getBalanceAfterByTransactionId = ({
  cashboxes,
  transactions,
}: {
  cashboxes: Cashbox[];
  transactions: FinanceTransaction[];
}) => {
  const balancesByCashboxCurrency = new Map<string, number>();
  const allCurrencyCodes = Array.from(
    new Set([
      ...currencyOptions,
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

  const chronologicalDesc = [...transactions].sort((first, second) =>
    second.transactionDate.localeCompare(first.transactionDate),
  );
  const result: Record<string, number | null> = {};
  chronologicalDesc.forEach((transaction) => {
    const fromKey = transaction.fromCashbox?.id
      ? `${transaction.fromCashbox.id}:${transaction.currency}`
      : '';
    const toKey = transaction.toCashbox?.id
      ? `${transaction.toCashbox.id}:${transaction.currency}`
      : '';

    const senderBalanceAfter =
      fromKey.length > 0 ? (balancesByCashboxCurrency.get(fromKey) ?? 0) : null;
    const recipientBalanceAfter =
      toKey.length > 0 ? (balancesByCashboxCurrency.get(toKey) ?? 0) : null;

    if (transaction.type === 'deposit') {
      result[transaction.id] = recipientBalanceAfter;
    } else {
      result[transaction.id] = senderBalanceAfter;
    }

    if (transaction.fromCashbox?.id) {
      balancesByCashboxCurrency.set(
        fromKey,
        (senderBalanceAfter ?? 0) + transaction.amount,
      );
    }

    if (transaction.toCashbox?.id) {
      balancesByCashboxCurrency.set(
        toKey,
        (recipientBalanceAfter ?? 0) - transaction.amount,
      );
    }
  });
  return result;
};

export const filterFinanceTransactions = ({
  filters,
  selectedCashboxId,
  transactions,
}: {
  filters: TransactionFilters;
  selectedCashboxId: string;
  transactions: FinanceTransaction[];
}) => {
  const normalizedNote = filters.note.trim().toLowerCase();
  const filtered = transactions.filter((transaction) => {
    if (filters.type && transaction.type !== filters.type) return false;
    if (filters.currency && transaction.currency !== filters.currency) return false;
    if (
      filters.fromCashboxId &&
      transaction.fromCashbox?.id !== filters.fromCashboxId
    ) {
      return false;
    }
    if (
      filters.toCashboxId &&
      transaction.toCashbox?.id !== filters.toCashboxId
    ) {
      return false;
    }
    if (normalizedNote) {
      const transactionNote = transaction.note.trim().toLowerCase();
      if (!transactionNote.includes(normalizedNote)) return false;
    }
    if (
      selectedCashboxId &&
      transaction.fromCashbox?.id !== selectedCashboxId &&
      transaction.toCashbox?.id !== selectedCashboxId
    ) {
      return false;
    }
    if (filters.dateFrom) {
      const txDate = transaction.transactionDate.slice(0, 10);
      if (txDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const txDate = transaction.transactionDate.slice(0, 10);
      if (txDate > filters.dateTo) return false;
    }
    return true;
  });

  return [...filtered].sort((first, second) => {
    const direction = filters.sortDirection === 'asc' ? 1 : -1;
    switch (filters.sortBy) {
      case 'type':
        return first.type.localeCompare(second.type) * direction;
      case 'amount':
        return (first.amount - second.amount) * direction;
      case 'currency':
        return first.currency.localeCompare(second.currency) * direction;
      case 'from':
        return (
          (first.fromCashbox?.name ?? '').localeCompare(
            second.fromCashbox?.name ?? '',
          ) * direction
        );
      case 'to':
        return (
          (first.toCashbox?.name ?? '').localeCompare(
            second.toCashbox?.name ?? '',
          ) * direction
        );
      case 'date':
      default:
        return first.transactionDate.localeCompare(second.transactionDate) * direction;
    }
  });
};

export const paginateAccountingItems = <T>(
  items: T[],
  page: number,
  pageSize: number,
) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

export const getActiveTransactionFiltersCount = (filters: TransactionFilters) =>
  (filters.type ? 1 : 0) +
  (filters.currency ? 1 : 0) +
  (filters.fromCashboxId ? 1 : 0) +
  (filters.toCashboxId ? 1 : 0) +
  (filters.note.trim() ? 1 : 0) +
  (filters.dateFrom ? 1 : 0) +
  (filters.dateTo ? 1 : 0);

export const getAllowedAccountingTransactionCurrencies = ({
  allCurrencyCodes,
  cashboxes,
  fromCashboxId,
  getCurrencyBalance,
  isCashboxCurrencyActive,
  isGlobalCurrencyActive,
  toCashboxId,
  type,
}: {
  allCurrencyCodes: string[];
  cashboxes: Cashbox[];
  fromCashboxId?: string;
  getCurrencyBalance: CurrencyBalanceGetter;
  isCashboxCurrencyActive: (cashboxId: string, currencyCode: string) => boolean;
  isGlobalCurrencyActive: (currencyCode: string) => boolean;
  toCashboxId?: string;
  type: FinanceTransactionType;
}) => {
  const fromCashbox = cashboxes.find(
    (cashbox) => cashbox.id === (fromCashboxId ?? ''),
  );
  const toCashbox = cashboxes.find(
    (cashbox) => cashbox.id === (toCashboxId ?? ''),
  );
  const canAcceptIn = (cashbox: Cashbox | undefined, currency: string) => {
    if (!cashbox) return false;
    return (
      isGlobalCurrencyActive(currency) &&
      isCashboxCurrencyActive(cashbox.id, currency)
    );
  };
  const canWithdrawFrom = (cashbox: Cashbox | undefined, currency: string) => {
    if (!cashbox) return false;
    return canAcceptIn(cashbox, currency) || getCurrencyBalance(cashbox, currency) > 0;
  };

  if (type === 'withdraw') {
    return allCurrencyCodes.filter((currency) =>
      canWithdrawFrom(fromCashbox, currency),
    );
  }
  if (type === 'deposit') {
    return allCurrencyCodes.filter((currency) => canAcceptIn(toCashbox, currency));
  }
  return allCurrencyCodes.filter(
    (currency) =>
      canWithdrawFrom(fromCashbox, currency) && canAcceptIn(toCashbox, currency),
  );
};

export const normalizeCurrencyActivity = (
  current: Record<string, boolean>,
  allCurrencyCodes: string[],
) => {
  let changed = false;
  const normalized = allCurrencyCodes.reduce<Record<string, boolean>>(
    (acc, currency) => {
      const nextValue = currency === 'UAH' ? true : (current[currency] ?? true);
      acc[currency] = nextValue;
      if (!changed && current[currency] !== nextValue) {
        changed = true;
      }
      return acc;
    },
    {},
  );
  if (!changed) {
    const currentKeys = Object.keys(current).sort();
    const nextKeys = Object.keys(normalized).sort();
    changed =
      currentKeys.length !== nextKeys.length ||
      currentKeys.some((key, index) => key !== nextKeys[index]);
  }
  return changed ? normalized : current;
};

export const normalizeCashboxCurrencyActivity = ({
  allCashboxes,
  allCurrencyCodes,
  current,
}: {
  allCashboxes: Cashbox[];
  allCurrencyCodes: string[];
  current: Record<string, Record<string, boolean>>;
}) => {
  let changed = false;
  const nextByCashbox = allCashboxes.reduce<Record<string, Record<string, boolean>>>(
    (acc, cashbox) => {
      const currentCashboxActivity = current[cashbox.id] ?? {};
      const nextCurrencyMap = allCurrencyCodes.reduce<Record<string, boolean>>(
        (currencyAcc, currencyCode) => {
          const nextValue =
            currencyCode === 'UAH'
              ? true
              : (currentCashboxActivity[currencyCode] ?? true);
          currencyAcc[currencyCode] = nextValue;
          if (!changed && currentCashboxActivity[currencyCode] !== nextValue) {
            changed = true;
          }
          return currencyAcc;
        },
        {},
      );
      acc[cashbox.id] = nextCurrencyMap;
      return acc;
    },
    {},
  );

  if (!changed) {
    const currentKeys = Object.keys(current).sort();
    const nextKeys = Object.keys(nextByCashbox).sort();
    changed =
      currentKeys.length !== nextKeys.length ||
      currentKeys.some((key, index) => key !== nextKeys[index]);
  }

  return changed ? nextByCashbox : current;
};

export const canPerformTransferBetweenCashboxes = (fromCashboxId?: string, toCashboxId?: string) =>
  Boolean(fromCashboxId) && Boolean(toCashboxId) && fromCashboxId !== toCashboxId;

export const resolvePreferredTargetCashboxId = ({
  type,
  fromCashboxId = '',
  fallbackCashboxId = '',
  cashboxes,
  lastTargetCashboxByType = {},
  preferFallback = false,
}: {
  type: FinanceTransactionType;
  fromCashboxId?: string;
  fallbackCashboxId?: string;
  cashboxes: Cashbox[];
  lastTargetCashboxByType?: TransactionTargetMemory;
  preferFallback?: boolean;
}): string => {
  if (type === 'withdraw') return '';
  const has = (id: string) => cashboxes.some((c) => c.id === id);
  if (
    type === 'deposit' &&
    preferFallback &&
    fallbackCashboxId &&
    has(fallbackCashboxId)
  ) {
    return fallbackCashboxId;
  }
  const remembered = lastTargetCashboxByType[type as keyof TransactionTargetMemory];
  if (remembered && has(remembered)) {
    if (type !== 'transfer' || remembered !== fromCashboxId) {
      return remembered;
    }
  }
  if (fallbackCashboxId && has(fallbackCashboxId)) {
    /* v8 ignore next 3 -- secondCashboxId is selected to differ from the transfer source. */
    if (type === 'transfer' && fallbackCashboxId === fromCashboxId) {
      return cashboxes.find((c) => c.id !== fromCashboxId)?.id ?? '';
    }
    return fallbackCashboxId;
  }
  if (type === 'transfer') {
    return cashboxes.find((c) => c.id !== fromCashboxId)?.id ?? '';
  }
  return cashboxes[0]?.id ?? '';
};

export const reorderCashboxes = (
  items: Cashbox[],
  fromId: string,
  toId: string,
): Cashbox[] => {
  const fromIndex = items.findIndex((item) => item.id === fromId);
  const toIndex = items.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};
