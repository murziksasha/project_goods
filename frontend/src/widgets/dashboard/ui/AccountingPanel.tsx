import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelFinanceTransaction,
  createCashbox,
  createFinanceTransaction,
  getCashboxes,
  getFinanceReport,
  getFinanceTransactions,
  getSupplierOrdersForPayment,
  issueSupplierOrderWithoutPayment,
  paySupplierOrder,
  updateCashbox,
} from '../../../entities/finance/api/financeApi';
import { getSupplierOrders } from '../../../entities/supplier-order/api/supplierOrderApi';
import type {
  Cashbox,
  FinanceCurrency,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import { SupplierOrderModal } from './SupplierOrderModal';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { PaginationPanel } from '../../../shared/ui/PaginationPanel';
import type { Employee } from '../../../entities/employee/model/types';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import { formatMetric } from '../model/sales-analytics';
import { getSupplierOrderDisplayNumber } from '../model/supplier-order-utils';
import {
  CancelTransferModal,
  IssueWithoutPaymentModal,
} from './AccountingConfirmModals';
import { AccountingFinanceSettings } from './AccountingFinanceSettings';
import {
  accountingCashboxCurrencyActivityStorageKey,
  accountingCashboxOrderStorageKey,
  accountingCurrenciesStorageKey,
  accountingCurrencyActivityStorageKey,
  accountingExpandedFinanceSettingsCardStorageKey,
  accountingFinanceSettingsTabStorageKey,
  accountingLastTargetCashboxByTypeStorageKey,
  accountingSettingsOpenStorageKey,
  accountingTabStorageKey,
  applyCashboxOrder,
  currencyOptions,
  formatCurrencyTotals,
  formatDateDdMmYyyy,
  formatMoney,
  formatPercent,
  formatTransactionDayLabel,
  getAccountingTabFromUrl,
  getLocalDateKey,
  getStoredAccountingSettingsOpen,
  getStoredAccountingTab,
  getStoredExpandedFinanceSettingsCard,
  initialTransactionFilters,
  initialTransactionForm,
  transactionLabels,
  truncateLabel,
  type AccountingTab,
  type TransactionFilters,
  type TransactionTargetMemory,
} from '../model/accounting';

type AccountingPanelProps = {
  currentEmployee: Employee | null;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  sales: Sale[];
  onOpenSaleCard: (sale: { id: string; kind: 'repair' | 'sale' }) => void;
};

export const AccountingPanel = ({
  currentEmployee,
  onError,
  onSuccess,
  sales,
  onOpenSaleCard,
}: AccountingPanelProps) => {
  const [activeTab, setActiveTab] = useState<AccountingTab>(
    () => getAccountingTabFromUrl() ?? getStoredAccountingTab(),
  );
  const [cashboxes, setCashboxes] = useState<Cashbox[]>([]);
  const [allCashboxes, setAllCashboxes] = useState<Cashbox[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
  const [supplierOrdersQueue, setSupplierOrdersQueue] = useState<SupplierOrderPaymentQueueItem[]>([]);
  const [selectedSupplierOrder, setSelectedSupplierOrder] = useState<SupplierOrder | null>(null);
  const [transferToCancel, setTransferToCancel] = useState<FinanceTransaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newCashboxName, setNewCashboxName] = useState('');
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [isTransactionsFilterOpen, setIsTransactionsFilterOpen] = useState(false);
  const [isTransactionsDateFilterOpen, setIsTransactionsDateFilterOpen] = useState(false);
  const [selectedTransactionCashboxId, setSelectedTransactionCashboxId] = useState('');
  const [draftTransactionFilters, setDraftTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [appliedTransactionFilters, setAppliedTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(30);
  const [draggedCashboxId, setDraggedCashboxId] = useState<string | null>(null);
  const [isCashboxesOrderHydrated, setIsCashboxesOrderHydrated] = useState(false);
  const [withoutPaymentOrder, setWithoutPaymentOrder] = useState<SupplierOrderPaymentQueueItem | null>(null);
  const [isFinanceSettingsOpen, setIsFinanceSettingsOpen] = useState(getStoredAccountingSettingsOpen);
  const [financeSettingsTab, setFinanceSettingsTab] = useState<'cashboxes' | 'currencies'>(() => {
    try {
      const storedTab = window.localStorage.getItem(accountingFinanceSettingsTabStorageKey);
      return storedTab === 'cashboxes' || storedTab === 'currencies' ? storedTab : 'cashboxes';
    } catch {
      return 'cashboxes';
    }
  });
  const [expandedFinanceSettingsCard, setExpandedFinanceSettingsCard] =
    useState<string | null>(getStoredExpandedFinanceSettingsCard);
  const [editingCashboxId, setEditingCashboxId] = useState<string | null>(null);
  const [editingCashboxName, setEditingCashboxName] = useState('');
  const [customCurrencies, setCustomCurrencies] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(accountingCurrenciesStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [currencyActivity, setCurrencyActivity] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem(accountingCurrencyActivityStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).reduce<Record<string, boolean>>((acc, [currency, value]) => {
        acc[currency] = Boolean(value);
        return acc;
      }, {});
    } catch {
      return {};
    }
  });
  const [cashboxCurrencyActivity, setCashboxCurrencyActivity] = useState<Record<string, Record<string, boolean>>>(() => {
    try {
      const raw = window.localStorage.getItem(accountingCashboxCurrencyActivityStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).reduce<Record<string, Record<string, boolean>>>((acc, [cashboxId, value]) => {
        if (!value || typeof value !== 'object') return acc;
        const currencyMap = value as Record<string, unknown>;
        acc[cashboxId] = Object.entries(currencyMap).reduce<Record<string, boolean>>((currencyAcc, [code, flag]) => {
          currencyAcc[code] = Boolean(flag);
          return currencyAcc;
        }, {});
        return acc;
      }, {});
    } catch {
      return {};
    }
  });
  const [lastTargetCashboxByType, setLastTargetCashboxByType] = useState<TransactionTargetMemory>(() => {
    try {
      const raw = window.localStorage.getItem(accountingLastTargetCashboxByTypeStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next: TransactionTargetMemory = {};
      if (typeof parsed.deposit === 'string') {
        next.deposit = parsed.deposit;
      }
      if (typeof parsed.transfer === 'string') {
        next.transfer = parsed.transfer;
      }
      return next;
    } catch {
      return {};
    }
  });
  const canManageCashboxes = hasEmployeePermission(currentEmployee, 'finance.cashboxes.manage');
  const canCreateDeposit = hasEmployeePermission(currentEmployee, 'finance.transactions.deposit');
  const canCreateWithdraw = hasEmployeePermission(currentEmployee, 'finance.transactions.withdraw');
  const canCreateTransfer = hasEmployeePermission(currentEmployee, 'finance.transactions.transfer');
  const canPaySupplierOrders = hasEmployeePermission(currentEmployee, 'finance.supplierOrders.pay');
  const canIssueSupplierOrdersWithoutPayment = hasEmployeePermission(
    currentEmployee,
    'finance.supplierOrders.issueWithoutPayment',
  );
  const permittedTransactionTypes = useMemo(
    () =>
      ([
        canCreateDeposit ? 'deposit' : null,
        canCreateWithdraw ? 'withdraw' : null,
        canCreateTransfer ? 'transfer' : null,
      ].filter(Boolean) as FinanceTransactionType[]),
    [canCreateDeposit, canCreateTransfer, canCreateWithdraw],
  );

  const allCurrencyCodes = useMemo(
    () =>
      Array.from(
        new Set<string>([...currencyOptions, ...customCurrencies]),
      ),
    [customCurrencies],
  );
  const isGlobalCurrencyActive = useCallback(
    (currencyCode: string) => currencyCode === 'UAH' || currencyActivity[currencyCode] !== false,
    [currencyActivity],
  );
  const isCashboxCurrencyActive = useCallback(
    (cashboxId: string, currencyCode: string) => {
      if (currencyCode === 'UAH') return true;
      return cashboxCurrencyActivity[cashboxId]?.[currencyCode] ?? true;
    },
    [cashboxCurrencyActivity],
  );
  const getCurrencyBalance = useCallback((cashbox: Cashbox, currencyCode: string) => {
    if (currencyOptions.includes(currencyCode as FinanceCurrency)) {
      return cashbox.balances[currencyCode as FinanceCurrency];
    }
    return 0;
  }, []);
  const cashboxCurrencyRows = useCallback(
    (cashbox: Cashbox) => {
      const activeRows = allCurrencyCodes
        .map((currencyCode) => {
          const balance = getCurrencyBalance(cashbox, currencyCode);
          const canAccept = isGlobalCurrencyActive(currencyCode) && isCashboxCurrencyActive(cashbox.id, currencyCode);
          const canWithdraw = canAccept || balance > 0;
          return {
            currency: currencyCode,
            balance,
            canAccept,
            canWithdraw,
          };
        })
        .filter((item) => item.canWithdraw);
      return activeRows;
    },
    [allCurrencyCodes, getCurrencyBalance, isCashboxCurrencyActive, isGlobalCurrencyActive],
  );

  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId = cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';
  const resolvePreferredTargetCashboxId = useCallback(
    (type: FinanceTransactionType, fromCashboxId: string, fallbackCashboxId: string) => {
      if (type === 'withdraw') return '';
      const remembered = type === 'deposit' || type === 'transfer'
        ? lastTargetCashboxByType[type]
        : undefined;
      if (remembered && cashboxes.some((cashbox) => cashbox.id === remembered)) {
        if (type !== 'transfer' || remembered !== fromCashboxId) {
          return remembered;
        }
      }
      if (fallbackCashboxId && cashboxes.some((cashbox) => cashbox.id === fallbackCashboxId)) {
        if (type !== 'transfer' || fallbackCashboxId !== fromCashboxId) {
          return fallbackCashboxId;
        }
      }
      if (type === 'transfer') {
        return cashboxes.find((cashbox) => cashbox.id !== fromCashboxId)?.id ?? '';
      }
      return firstCashboxId;
    },
    [cashboxes, firstCashboxId, lastTargetCashboxByType],
  );

  const refreshFinance = useCallback(async () => {
    setIsLoading(true);
    try {
      const [activeCashboxesData, allCashboxesData, transactionsData, reportData, supplierOrdersData] = await Promise.all([
        getCashboxes(),
        getCashboxes({ includeArchived: true }),
        getFinanceTransactions(),
        getFinanceReport(),
        getSupplierOrdersForPayment(),
      ]);
      const allSupplierOrders = await getSupplierOrders();
      let orderedCashboxes = activeCashboxesData;
      try {
        const storedOrder = JSON.parse(
          window.localStorage.getItem(accountingCashboxOrderStorageKey) ?? '[]',
        ) as string[];
        if (Array.isArray(storedOrder)) {
          orderedCashboxes = applyCashboxOrder(activeCashboxesData, storedOrder);
        }
      } catch {
        orderedCashboxes = activeCashboxesData;
      }
      setCashboxes(orderedCashboxes);
      setAllCashboxes(allCashboxesData);
      setIsCashboxesOrderHydrated(true);
      setTransactions(transactionsData);
      setReport(reportData);
      setSupplierOrdersQueue(supplierOrdersData);
      setSupplierOrders(allSupplierOrders);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load finance data.');
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refreshFinance();
  }, [refreshFinance]);

  useEffect(() => {
    const refreshOnOrderPayment = () => {
      void refreshFinance();
    };

    window.addEventListener('project-goods:finance-updated', refreshOnOrderPayment);

    return () => {
      window.removeEventListener('project-goods:finance-updated', refreshOnOrderPayment);
    };
  }, [refreshFinance]);

  useEffect(() => {
    try {
      window.localStorage.setItem(accountingTabStorageKey, activeTab);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeTab]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('accountingTab', activeTab);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Ignore URL update errors.
    }
  }, [activeTab]);

  useEffect(() => {
    const syncTabFromHistory = () => {
      const tabFromUrl = getAccountingTabFromUrl();
      if (!tabFromUrl) return;
      setActiveTab(tabFromUrl);
    };

    window.addEventListener('popstate', syncTabFromHistory);
    return () => {
      window.removeEventListener('popstate', syncTabFromHistory);
    };
  }, []);

  useEffect(() => {
    if (!isCashboxesOrderHydrated || cashboxes.length === 0) return;
    try {
      const order = cashboxes.map((cashbox) => cashbox.id);
      window.localStorage.setItem(
        accountingCashboxOrderStorageKey,
        JSON.stringify(order),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [cashboxes, isCashboxesOrderHydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingCurrenciesStorageKey,
        JSON.stringify(customCurrencies),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [customCurrencies]);

  useEffect(() => {
    setCurrencyActivity((current) => {
      let changed = false;
      const normalized = allCurrencyCodes.reduce<Record<string, boolean>>((acc, currency) => {
        const nextValue = currency === 'UAH' ? true : (current[currency] ?? true);
        acc[currency] = nextValue;
        if (!changed && current[currency] !== nextValue) {
          changed = true;
        }
        return acc;
      }, {});
      if (!changed) {
        const currentKeys = Object.keys(current).sort();
        const nextKeys = Object.keys(normalized).sort();
        changed =
          currentKeys.length !== nextKeys.length ||
          currentKeys.some((key, index) => key !== nextKeys[index]);
      }
      return changed ? normalized : current;
    });
  }, [allCurrencyCodes]);

  useEffect(() => {
    if (!isCashboxesOrderHydrated) return;
    setCashboxCurrencyActivity((current) => {
      let changed = false;
      const nextByCashbox = allCashboxes.reduce<Record<string, Record<string, boolean>>>((acc, cashbox) => {
        const currentCashboxActivity = current[cashbox.id] ?? {};
        const nextCurrencyMap = allCurrencyCodes.reduce<Record<string, boolean>>((currencyAcc, currencyCode) => {
          const nextValue = currencyCode === 'UAH' ? true : (currentCashboxActivity[currencyCode] ?? true);
          currencyAcc[currencyCode] = nextValue;
          if (!changed && currentCashboxActivity[currencyCode] !== nextValue) {
            changed = true;
          }
          return currencyAcc;
        }, {});
        acc[cashbox.id] = nextCurrencyMap;
        return acc;
      }, {});

      if (!changed) {
        const currentKeys = Object.keys(current).sort();
        const nextKeys = Object.keys(nextByCashbox).sort();
        changed =
          currentKeys.length !== nextKeys.length ||
          currentKeys.some((key, index) => key !== nextKeys[index]);
      }

      return changed ? nextByCashbox : current;
    });
  }, [allCashboxes, allCurrencyCodes, isCashboxesOrderHydrated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingCurrencyActivityStorageKey,
        JSON.stringify(currencyActivity),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [currencyActivity]);

  useEffect(() => {
    if (!isCashboxesOrderHydrated) return;
    try {
      window.localStorage.setItem(
        accountingCashboxCurrencyActivityStorageKey,
        JSON.stringify(cashboxCurrencyActivity),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [cashboxCurrencyActivity, isCashboxesOrderHydrated]);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingLastTargetCashboxByTypeStorageKey,
        JSON.stringify(lastTargetCashboxByType),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [lastTargetCashboxByType]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingFinanceSettingsTabStorageKey,
        financeSettingsTab,
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [financeSettingsTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        accountingSettingsOpenStorageKey,
        String(isFinanceSettingsOpen),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [isFinanceSettingsOpen]);

  useEffect(() => {
    try {
      if (expandedFinanceSettingsCard) {
        window.localStorage.setItem(
          accountingExpandedFinanceSettingsCardStorageKey,
          expandedFinanceSettingsCard,
        );
      } else {
        window.localStorage.removeItem(accountingExpandedFinanceSettingsCardStorageKey);
      }
    } catch {
      // Ignore localStorage write errors.
    }
  }, [expandedFinanceSettingsCard]);

  const totals = useMemo(
    () =>
      cashboxes.reduce(
        (summary, cashbox) => ({
          UAH: summary.UAH + cashbox.balances.UAH,
          USD: summary.USD + cashbox.balances.USD,
        }),
        { UAH: 0, USD: 0 },
      ),
    [cashboxes],
  );

  const financeOverview = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());
    const currencyRows = allCurrencyCodes
      .map((currency) => {
        const total =
          report?.totals[currency] ??
          cashboxes.reduce((sum, cashbox) => sum + getCurrencyBalance(cashbox, currency), 0);
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
      .filter((row) => row.total !== 0 || row.todayTurnover !== 0 || isGlobalCurrencyActive(row.currency));

    const todayTransactions = transactions.filter(
      (transaction) => getLocalDateKey(transaction.transactionDate) === todayKey,
    );
    const todayByType = todayTransactions.reduce<Record<FinanceTransactionType, Record<string, number>>>(
      (acc, transaction) => {
        acc[transaction.type][transaction.currency] =
          (acc[transaction.type][transaction.currency] ?? 0) + transaction.amount;
        return acc;
      },
      { deposit: {}, withdraw: {}, transfer: {} },
    );
    const pendingSupplierTotal = supplierOrdersQueue.reduce((sum, order) => sum + order.total, 0);
    const recentTransactions = [...transactions]
      .sort(
        (left, right) =>
          new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
      )
      .slice(0, 6);

    return {
      currencyRows,
      todayByType,
      pendingSupplierTotal,
      pendingSupplierCount: supplierOrdersQueue.length,
      recentTransactions,
      activeCashboxCount: cashboxes.length,
      archivedCashboxCount: allCashboxes.filter((cashbox) => cashbox.isArchived).length,
      transactionCount: report?.transactionCount ?? transactions.length,
      todayTransactionCount: report?.todayTransactionCount ?? todayTransactions.length,
    };
  }, [
    allCashboxes,
    allCurrencyCodes,
    cashboxes,
    getCurrencyBalance,
    isGlobalCurrencyActive,
    report,
    supplierOrdersQueue,
    transactions,
  ]);

  const startTransaction = (type: FinanceTransactionType, cashbox: Cashbox) => {
    if (!permittedTransactionTypes.includes(type)) {
      onError('Current employee does not have permission for this finance operation.');
      return;
    }
    const nextFromCashboxId = type === 'withdraw' || type === 'transfer' ? cashbox.id : '';
    const fallbackToCashboxId = type === 'deposit' ? cashbox.id : secondCashboxId;
    const nextToCashboxId = resolvePreferredTargetCashboxId(type, nextFromCashboxId, fallbackToCashboxId);
    const availableCurrencies = getAllowedTransactionCurrencies(
      type,
      nextFromCashboxId,
      nextToCashboxId,
    );
    setActiveTab('cashboxes');
    setTransactionForm({
      ...initialTransactionForm,
      type,
      fromCashboxId: nextFromCashboxId,
      toCashboxId: nextToCashboxId,
      currency: availableCurrencies[0] ?? initialTransactionForm.currency,
    });
  };

  const handleTransactionTypeChange = (nextType: FinanceTransactionType) => {
    if (!permittedTransactionTypes.includes(nextType)) return;
    setTransactionForm((current) => {
      const nextFromCashboxId =
        nextType === 'deposit'
          ? ''
          : current.fromCashboxId || firstCashboxId;
      const fallbackToCashboxId =
        nextType === 'deposit'
          ? (current.toCashboxId || firstCashboxId)
          : secondCashboxId;
      const nextToCashboxId = resolvePreferredTargetCashboxId(
        nextType,
        nextFromCashboxId,
        fallbackToCashboxId,
      );
      return {
        ...current,
        type: nextType,
        fromCashboxId: nextFromCashboxId,
        toCashboxId: nextToCashboxId,
      };
    });
  };

  const openCashboxTransactions = (cashbox: Cashbox) => {
    setActiveTab('transactions');
    setSelectedTransactionCashboxId(cashbox.id);
    setTransactionsPage(1);
  };

  const startEditCashbox = (cashbox: Cashbox) => {
    setEditingCashboxId(cashbox.id);
    setEditingCashboxName(cashbox.name);
  };

  const saveCashbox = async () => {
    if (!editingCashboxId) return;
    if (!canManageCashboxes) {
      onError('Current employee does not have permission to manage cashboxes.');
      return;
    }
    setIsSaving(true);
    try {
      await updateCashbox(editingCashboxId, { name: editingCashboxName.trim() });
      onSuccess('Cashbox updated.');
      setEditingCashboxId(null);
      setEditingCashboxName('');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update cashbox.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCashboxArchived = async (cashbox: Cashbox) => {
    if (!canManageCashboxes) {
      onError('Current employee does not have permission to manage cashboxes.');
      return;
    }
    setIsSaving(true);
    try {
      await updateCashbox(cashbox.id, { isArchived: !cashbox.isArchived });
      onSuccess(cashbox.isArchived ? 'Cashbox reactivated.' : 'Cashbox deactivated.');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update cashbox status.');
    } finally {
      setIsSaving(false);
    }
  };

  const addCurrencyCode = () => {
    const normalized = newCurrencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3,6}$/.test(normalized)) {
      onError('Currency code must be 3-6 latin letters.');
      return;
    }
    if (currencyOptions.includes(normalized as FinanceCurrency) || customCurrencies.includes(normalized)) {
      onError('Currency already exists.');
      return;
    }
    setCustomCurrencies((current) => [...current, normalized]);
    setNewCurrencyCode('');
  };

  const removeCurrencyCode = (code: string) => {
    if (code === 'UAH') {
      onError('UAH is the main currency and cannot be removed.');
      return;
    }
    const hasFundsInActiveCashboxes = allCashboxes.some(
      (cashbox) => !cashbox.isArchived && getCurrencyBalance(cashbox, code) > 0,
    );
    if (hasFundsInActiveCashboxes) {
      onError('Cannot remove currency while active cashboxes have non-zero balance in it.');
      return;
    }
    setCustomCurrencies((current) => current.filter((item) => item !== code));
    setCurrencyActivity((current) => {
      if (!(code in current)) return current;
      const next = { ...current };
      delete next[code];
      return next;
    });
    setCashboxCurrencyActivity((current) => {
      const next: Record<string, Record<string, boolean>> = {};
      Object.entries(current).forEach(([cashboxId, value]) => {
        const nextValue = { ...value };
        delete nextValue[code];
        next[cashboxId] = nextValue;
      });
      return next;
    });
  };

  const handleRemoveCurrency = (code: string) => {
    if (currencyOptions.includes(code as FinanceCurrency)) {
      setCurrencyActivity((current) => ({ ...current, [code]: false }));
      return;
    }
    removeCurrencyCode(code);
  };

  const toggleFinanceSettingsCard = (cardId: string) => {
    setExpandedFinanceSettingsCard((current) => (current === cardId ? null : cardId));
  };

  const toggleCurrencyActivity = (currencyCode: string) => {
    if (currencyCode === 'UAH') {
      onError('UAH is always active.');
      return;
    }
    setCurrencyActivity((current) => ({
      ...current,
      [currencyCode]: current[currencyCode] === false,
    }));
  };

  const toggleCashboxCurrencyActivity = (cashboxId: string, currencyCode: string) => {
    if (currencyCode === 'UAH') {
      onError('UAH is always active.');
      return;
    }
    setCashboxCurrencyActivity((current) => {
      const cashboxMap = current[cashboxId] ?? {};
      return {
        ...current,
        [cashboxId]: {
          ...cashboxMap,
          [currencyCode]: cashboxMap[currencyCode] === false,
        },
      };
    });
  };

  const getAllowedTransactionCurrencies = useCallback(
    (
      type: FinanceTransactionType,
      fromCashboxId: string | undefined,
      toCashboxId: string | undefined,
    ) => {
      const fromCashbox = cashboxes.find((cashbox) => cashbox.id === (fromCashboxId ?? ''));
      const toCashbox = cashboxes.find((cashbox) => cashbox.id === (toCashboxId ?? ''));
      const canAcceptIn = (cashbox: Cashbox | undefined, currency: string) => {
        if (!cashbox) return false;
        return isGlobalCurrencyActive(currency) && isCashboxCurrencyActive(cashbox.id, currency);
      };
      const canWithdrawFrom = (cashbox: Cashbox | undefined, currency: string) => {
        if (!cashbox) return false;
        return canAcceptIn(cashbox, currency) || getCurrencyBalance(cashbox, currency) > 0;
      };

      if (type === 'withdraw') {
        return allCurrencyCodes.filter((currency) => canWithdrawFrom(fromCashbox, currency));
      }
      if (type === 'deposit') {
        return allCurrencyCodes.filter((currency) => canAcceptIn(toCashbox, currency));
      }
      return allCurrencyCodes.filter(
        (currency) => canWithdrawFrom(fromCashbox, currency) && canAcceptIn(toCashbox, currency),
      );
    },
    [allCurrencyCodes, cashboxes, getCurrencyBalance, isCashboxCurrencyActive, isGlobalCurrencyActive],
  );

  const allowedTransactionCurrencies = useMemo(
    () =>
      getAllowedTransactionCurrencies(
        transactionForm.type,
        transactionForm.fromCashboxId,
        transactionForm.toCashboxId,
      ),
    [
      getAllowedTransactionCurrencies,
      transactionForm.fromCashboxId,
      transactionForm.toCashboxId,
      transactionForm.type,
    ],
  );

  useEffect(() => {
    if (allowedTransactionCurrencies.includes(transactionForm.currency)) return;
    const nextCurrency = allowedTransactionCurrencies[0];
    if (!nextCurrency) return;
    setTransactionForm((current) => ({ ...current, currency: nextCurrency }));
  }, [allowedTransactionCurrencies, transactionForm.currency]);

  const handleCreateCashbox = async () => {
    if (!newCashboxName.trim()) return;
    if (!canManageCashboxes) {
      onError('Current employee does not have permission to manage cashboxes.');
      return;
    }
    setIsSaving(true);
    try {
      await createCashbox({ name: newCashboxName });
      setNewCashboxName('');
      onSuccess('Cashbox created.');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to create cashbox.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!permittedTransactionTypes.includes(transactionForm.type)) {
      onError('Current employee does not have permission for this finance operation.');
      return;
    }
    const normalizedAmount = transactionForm.amount.replace(',', '.').trim();
    if (!allowedTransactionCurrencies.includes(transactionForm.currency)) {
      onError('Selected currency is not available for this operation.');
      return;
    }
    if (!Number.isFinite(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
      onError('Transaction amount must be greater than 0.');
      return;
    }
    setIsSaving(true);
    try {
      await createFinanceTransaction({
        ...transactionForm,
        amount: normalizedAmount,
      });
      if (
        (transactionForm.type === 'deposit' || transactionForm.type === 'transfer') &&
        transactionForm.toCashboxId
      ) {
        setLastTargetCashboxByType((current) => ({
          ...current,
          [transactionForm.type]: transactionForm.toCashboxId,
        }));
      }
      const nextInitialType: FinanceTransactionType = 'deposit';
      const nextToCashboxId = resolvePreferredTargetCashboxId(
        nextInitialType,
        '',
        firstCashboxId,
      );
      setTransactionForm({
        ...initialTransactionForm,
        type: permittedTransactionTypes[0] ?? nextInitialType,
        toCashboxId: nextToCashboxId,
      });
      onSuccess('Finance transaction saved.');
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to save transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  const canCancelTransferTransaction = (transaction: FinanceTransaction) =>
    canCreateTransfer &&
    transaction.type === 'transfer' &&
    Boolean(transaction.fromCashbox && transaction.toCashbox) &&
    (transaction.status ?? 'active') !== 'cancelled' &&
    !transaction.isCancellation &&
    !transaction.cancelsTransactionId;

  const handleCancelTransfer = async () => {
    if (!transferToCancel) return;
    if (!canCancelTransferTransaction(transferToCancel)) {
      onError('Only active transfers between cashboxes can be cancelled.');
      setTransferToCancel(null);
      return;
    }

    setIsSaving(true);
    try {
      await cancelFinanceTransaction(transferToCancel.id);
      onSuccess('Transfer cancelled. A reverse transaction was created.');
      setTransferToCancel(null);
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to cancel transfer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssueWithoutPayment = async () => {
    if (!withoutPaymentOrder) return;
    setIsSaving(true);
    try {
      await issueSupplierOrderWithoutPayment(withoutPaymentOrder.id);
      onSuccess('Order issued without payment.');
      window.dispatchEvent(new Event('project-goods:finance-updated'));
      setWithoutPaymentOrder(null);
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to issue order without payment.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderCashboxes = () => (
    <>
      <div className='finance-toolbar'>
        <div className='finance-total-strip'>
          <strong>{formatMoney(totals.UAH, 'UAH')}</strong>
          <span>{formatMoney(totals.USD, 'USD')}</span>
        </div>
        {canManageCashboxes ? (
          <div className='finance-add-cashbox'>
            <input value={newCashboxName} onChange={(event) => setNewCashboxName(event.target.value)} placeholder='New cashbox' />
            <button type='button' className='orders-create-button' onClick={handleCreateCashbox} disabled={isSaving}>
              Add cashbox
            </button>
          </div>
        ) : null}
      </div>

      <div className='finance-cashbox-grid'>
        {cashboxes.map((cashbox) => (
          <article
            key={cashbox.id}
            className='finance-cashbox-card'
            draggable
            onDragStart={() => setDraggedCashboxId(cashbox.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (!draggedCashboxId || draggedCashboxId === cashbox.id) {
                setDraggedCashboxId(null);
                return;
              }
              setCashboxes((current) => {
                const fromIndex = current.findIndex((item) => item.id === draggedCashboxId);
                const toIndex = current.findIndex((item) => item.id === cashbox.id);
                if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
                  return current;
                }
                const next = [...current];
                const [moved] = next.splice(fromIndex, 1);
                next.splice(toIndex, 0, moved);
                return next;
              });
              setDraggedCashboxId(null);
            }}
            onDragEnd={() => setDraggedCashboxId(null)}
          >
            <div className='finance-cashbox-heading'>
              <h3>{cashbox.name}</h3>
              {cashbox.isDefault ? <span>Default</span> : null}
            </div>
            <div className='finance-cashbox-balances'>
              {cashboxCurrencyRows(cashbox).length === 0 ? (
                <span className='finance-cashbox-balance-row finance-cashbox-balance-row-inactive'>
                  <strong>No active currency balances</strong>
                </span>
              ) : (
                cashboxCurrencyRows(cashbox).map(({ currency, balance, canAccept }) => (
                  <div
                    key={`${cashbox.id}-${currency}`}
                    className={
                      canAccept
                        ? 'finance-cashbox-balance-row'
                        : 'finance-cashbox-balance-row finance-cashbox-balance-row-inactive'
                    }
                  >
                    <strong
                      className={
                        currency === 'UAH'
                          ? 'finance-cashbox-balance-value finance-cashbox-balance-value-uah'
                          : 'finance-cashbox-balance-value'
                      }
                    >
                      {currency === 'UAH' ? (
                        <>
                          <span className='finance-cashbox-balance-amount'>
                            {new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(balance)}
                          </span>
                          <span className='finance-cashbox-balance-currency-code'>UAH</span>
                        </>
                      ) : (
                        formatMoney(balance, currency)
                      )}
                    </strong>
                    {canAccept ? null : <span title='Currency is inactive for receiving. You can only withdraw existing balance.'>Withdraw only</span>}
                  </div>
                ))
              )}
            </div>
            <div className='finance-cashbox-actions'>
              {canCreateWithdraw ? <button type='button' onClick={() => startTransaction('withdraw', cashbox)}>Withdraw</button> : null}
              {canCreateDeposit ? <button type='button' onClick={() => startTransaction('deposit', cashbox)}>Deposit</button> : null}
              {canCreateTransfer ? <button type='button' onClick={() => startTransaction('transfer', cashbox)}>Transfer</button> : null}
              <button type='button' onClick={() => openCashboxTransactions(cashbox)}>Transactions</button>
            </div>
          </article>
        ))}
      </div>

      {permittedTransactionTypes.length > 0 ? (
      <section className='finance-operation-panel'>
        <div className='panel-header'>
          <div>
            <p className='section-label'>Operation</p>
            <h2>{transactionLabels[transactionForm.type]}</h2>
          </div>
        </div>
        <div className='finance-operation-grid'>
          <label className='field'>
            <span>Type</span>
            <select value={transactionForm.type} onChange={(event) => handleTransactionTypeChange(event.target.value as FinanceTransactionType)}>
              {canCreateDeposit ? <option value='deposit'>Deposit</option> : null}
              {canCreateWithdraw ? <option value='withdraw'>Withdraw</option> : null}
              {canCreateTransfer ? <option value='transfer'>Transfer</option> : null}
            </select>
          </label>
          <label className='field'>
            <span>Amount</span>
            <NumberStepper min={0} value={transactionForm.amount} onChange={(value) => setTransactionForm((current) => ({ ...current, amount: value }))} />
          </label>
          <label className='field'>
            <span>Currency</span>
            <select
              value={allowedTransactionCurrencies.includes(transactionForm.currency) ? transactionForm.currency : ''}
              onChange={(event) => setTransactionForm((current) => ({ ...current, currency: event.target.value as FinanceCurrency }))}
              disabled={allowedTransactionCurrencies.length === 0}
            >
              {allowedTransactionCurrencies.length === 0 ? (
                <option value=''>No available currencies</option>
              ) : (
                allowedTransactionCurrencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))
              )}
            </select>
          </label>
          <label className='field'>
            <span>From cashbox</span>
            <select value={transactionForm.fromCashboxId} disabled={transactionForm.type === 'deposit'} onChange={(event) => setTransactionForm((current) => ({ ...current, fromCashboxId: event.target.value }))}>
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>{cashbox.name}</option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>To cashbox</span>
            <select value={transactionForm.toCashboxId} disabled={transactionForm.type === 'withdraw'} onChange={(event) => setTransactionForm((current) => ({ ...current, toCashboxId: event.target.value }))}>
              <option value=''>-</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>{cashbox.name}</option>
              ))}
            </select>
          </label>
          <label className='field'>
            <span>Comment</span>
            <input value={transactionForm.note} onChange={(event) => setTransactionForm((current) => ({ ...current, note: event.target.value }))} />
          </label>
        </div>
        <button
          type='button'
          className='primary-button'
          onClick={handleCreateTransaction}
          disabled={isSaving || !transactionForm.amount || allowedTransactionCurrencies.length === 0}
        >
          {isSaving ? 'Saving...' : 'Save operation'}
        </button>
      </section>
      ) : null}
    </>
  );

  const balanceAfterByTransactionId = useMemo(() => {
    const balancesByCashboxCurrency = new Map<string, number>();
    cashboxes.forEach((cashbox) => {
      currencyOptions.forEach((currency) => {
        balancesByCashboxCurrency.set(
          `${cashbox.id}:${currency}`,
          cashbox.balances[currency],
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
        fromKey.length > 0
          ? (balancesByCashboxCurrency.get(fromKey) ?? 0)
          : null;
      const recipientBalanceAfter =
        toKey.length > 0
          ? (balancesByCashboxCurrency.get(toKey) ?? 0)
          : null;

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
  }, [cashboxes, transactions]);

  const filteredTransactions = useMemo(() => {
    const normalizedNote = appliedTransactionFilters.note.trim().toLowerCase();
    const filtered = transactions.filter((transaction) => {
      if (
        appliedTransactionFilters.type &&
        transaction.type !== appliedTransactionFilters.type
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.currency &&
        transaction.currency !== appliedTransactionFilters.currency
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.fromCashboxId &&
        transaction.fromCashbox?.id !== appliedTransactionFilters.fromCashboxId
      ) {
        return false;
      }
      if (
        appliedTransactionFilters.toCashboxId &&
        transaction.toCashbox?.id !== appliedTransactionFilters.toCashboxId
      ) {
        return false;
      }
      if (normalizedNote) {
        const transactionNote = transaction.note.trim().toLowerCase();
        if (!transactionNote.includes(normalizedNote)) {
          return false;
        }
      }
      if (
        selectedTransactionCashboxId &&
        transaction.fromCashbox?.id !== selectedTransactionCashboxId &&
        transaction.toCashbox?.id !== selectedTransactionCashboxId
      ) {
        return false;
      }
      if (appliedTransactionFilters.dateFrom) {
        const txDate = transaction.transactionDate.slice(0, 10);
        if (txDate < appliedTransactionFilters.dateFrom) {
          return false;
        }
      }
      if (appliedTransactionFilters.dateTo) {
        const txDate = transaction.transactionDate.slice(0, 10);
        if (txDate > appliedTransactionFilters.dateTo) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...filtered].sort((first, second) => {
      const direction = appliedTransactionFilters.sortDirection === 'asc' ? 1 : -1;
      switch (appliedTransactionFilters.sortBy) {
        case 'type':
          return first.type.localeCompare(second.type) * direction;
        case 'amount':
          return (first.amount - second.amount) * direction;
        case 'currency':
          return first.currency.localeCompare(second.currency) * direction;
        case 'from':
          return (
            (first.fromCashbox?.name ?? '').localeCompare(second.fromCashbox?.name ?? '') *
            direction
          );
        case 'to':
          return (
            (first.toCashbox?.name ?? '').localeCompare(second.toCashbox?.name ?? '') *
            direction
          );
        case 'date':
        default:
          return first.transactionDate.localeCompare(second.transactionDate) * direction;
      }
    });

    return sorted;
  }, [appliedTransactionFilters, selectedTransactionCashboxId, transactions]);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * transactionsPageSize;
    return filteredTransactions.slice(start, start + transactionsPageSize);
  }, [filteredTransactions, transactionsPage, transactionsPageSize]);

  const activeTransactionFiltersCount = useMemo(
    () =>
      (appliedTransactionFilters.type ? 1 : 0) +
      (appliedTransactionFilters.currency ? 1 : 0) +
      (appliedTransactionFilters.fromCashboxId ? 1 : 0) +
      (appliedTransactionFilters.toCashboxId ? 1 : 0) +
      (appliedTransactionFilters.note.trim() ? 1 : 0) +
      (appliedTransactionFilters.dateFrom ? 1 : 0) +
      (appliedTransactionFilters.dateTo ? 1 : 0),
    [appliedTransactionFilters],
  );

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredTransactions.length / transactionsPageSize));
    if (transactionsPage > pageCount) {
      setTransactionsPage(pageCount);
    }
  }, [filteredTransactions.length, transactionsPage, transactionsPageSize]);

  const renderTransactions = () => (
    <>
      <div className='orders-toolbar'>
        <div className='orders-toolbar-left finance-transactions-toolbar-left'>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Previous page'
            onClick={() =>
              setTransactionsPage((current) => Math.max(1, current - 1))
            }
            disabled={transactionsPage <= 1}
          >
            &lsaquo;
          </button>
          <div className='finance-transactions-page-chip'>{transactionsPage}</div>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Next page'
            onClick={() => {
              const pageCount = Math.max(
                1,
                Math.ceil(filteredTransactions.length / transactionsPageSize),
              );
              setTransactionsPage((current) =>
                Math.min(pageCount, current + 1),
              );
            }}
            disabled={
              transactionsPage >=
              Math.max(
                1,
                Math.ceil(filteredTransactions.length / transactionsPageSize),
              )
            }
          >
            &rsaquo;
          </button>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isTransactionsFilterOpen}
            onClick={() => setIsTransactionsFilterOpen((current) => !current)}
          >
            Filter
            {activeTransactionFiltersCount > 0 ? (
              <span className='toolbar-filter-count'>{activeTransactionFiltersCount}</span>
            ) : null}
          </button>
          <button
            type='button'
            className='toolbar-filter-button toolbar-filter-toggle-button'
            aria-expanded={isTransactionsDateFilterOpen}
            onClick={() =>
              setIsTransactionsDateFilterOpen((current) => !current)
            }
          >
            Date
            {appliedTransactionFilters.dateFrom || appliedTransactionFilters.dateTo ? (
              <span className='toolbar-filter-count'>
                {appliedTransactionFilters.dateFrom &&
                appliedTransactionFilters.dateTo
                  ? '2'
                  : '1'}
              </span>
            ) : null}
          </button>
          <div className='finance-transactions-cashbox-select'>
            <select
              value={selectedTransactionCashboxId}
              onChange={(event) => {
                setSelectedTransactionCashboxId(event.target.value);
                setTransactionsPage(1);
              }}
              aria-label='Filter transactions by cashbox'
            >
              <option value=''>All cashboxes</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section
        className={
          isTransactionsFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type='button'
          className='orders-filter-panel-close'
          aria-label='Close filters panel'
          onClick={() => setIsTransactionsFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Type</span>
            <select
              value={draftTransactionFilters.type}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  type: event.target.value as '' | FinanceTransactionType,
                }))
              }
            >
              <option value=''>All</option>
              <option value='deposit'>Deposit</option>
              <option value='withdraw'>Withdraw</option>
              <option value='transfer'>Transfer</option>
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Currency</span>
            <select
              value={draftTransactionFilters.currency}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {allCurrencyCodes.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>From cashbox</span>
            <select
              value={draftTransactionFilters.fromCashboxId}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  fromCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>To cashbox</span>
            <select
              value={draftTransactionFilters.toCashboxId}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  toCashboxId: event.target.value,
                }))
              }
            >
              <option value=''>All</option>
              {cashboxes.map((cashbox) => (
                <option key={cashbox.id} value={cashbox.id}>
                  {cashbox.name}
                </option>
              ))}
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Note</span>
            <input
              type='text'
              value={draftTransactionFilters.note}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              placeholder='Order note'
            />
          </label>
          <label className='orders-filter-field'>
            <span>Sort by</span>
            <select
              value={draftTransactionFilters.sortBy}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  sortBy: event.target.value as TransactionFilters['sortBy'],
                }))
              }
            >
              <option value='date'>Date</option>
              <option value='type'>Type</option>
              <option value='amount'>Amount</option>
              <option value='currency'>Currency</option>
              <option value='from'>From cashbox</option>
              <option value='to'>To cashbox</option>
            </select>
          </label>
          <label className='orders-filter-field'>
            <span>Direction</span>
            <select
              value={draftTransactionFilters.sortDirection}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  sortDirection: event.target.value as TransactionFilters['sortDirection'],
                }))
              }
            >
              <option value='desc'>Descending</option>
              <option value='asc'>Ascending</option>
            </select>
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() => {
              setAppliedTransactionFilters({
                ...draftTransactionFilters,
                note: draftTransactionFilters.note.trim(),
              });
              setTransactionsPage(1);
            }}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDraftTransactionFilters(initialTransactionFilters);
              setAppliedTransactionFilters(initialTransactionFilters);
              setTransactionsPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>
      <section
        className={
          isTransactionsDateFilterOpen
            ? 'orders-filter-panel orders-filter-panel-open'
            : 'orders-filter-panel'
        }
      >
        <button
          type='button'
          className='orders-filter-panel-close'
          aria-label='Close date filters panel'
          onClick={() => setIsTransactionsDateFilterOpen(false)}
        >
          &times;
        </button>
        <div className='orders-filter-grid'>
          <label className='orders-filter-field'>
            <span>Date from</span>
            <input
              type='date'
              value={draftTransactionFilters.dateFrom}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </label>
          <label className='orders-filter-field'>
            <span>Date to</span>
            <input
              type='date'
              value={draftTransactionFilters.dateTo}
              onChange={(event) =>
                setDraftTransactionFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className='orders-filter-actions'>
          <button
            type='button'
            className='toolbar-filter-button orders-filter-apply'
            onClick={() => {
              setAppliedTransactionFilters((current) => ({
                ...current,
                dateFrom: draftTransactionFilters.dateFrom,
                dateTo: draftTransactionFilters.dateTo,
              }));
              setTransactionsPage(1);
            }}
          >
            Apply
          </button>
          <button
            type='button'
            className='toolbar-filter-button'
            onClick={() => {
              setDraftTransactionFilters((current) => ({
                ...current,
                dateFrom: '',
                dateTo: '',
              }));
              setAppliedTransactionFilters((current) => ({
                ...current,
                dateFrom: '',
                dateTo: '',
              }));
              setTransactionsPage(1);
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <div className='finance-table-wrap'>
        <table className='orders-table'>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Amount</th><th>Total</th><th>From</th><th>To</th><th>Note</th><th>Action</th></tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr><td colSpan={8} className='orders-empty'>Transactions not found.</td></tr>
            ) : (
                            paginatedTransactions.map((transaction, index) => {
                const currentDay = transaction.transactionDate.slice(0, 10);
                const previousDay = paginatedTransactions[index - 1]?.transactionDate.slice(0, 10);
                const isNewDay = index === 0 || currentDay !== previousDay;
                const isCancelled = (transaction.status ?? 'active') === 'cancelled';
                const isCancellation = transaction.isCancellation || Boolean(transaction.cancelsTransactionId);
                const canCancelTransfer = canCancelTransferTransaction(transaction);
                return (
                  <Fragment key={transaction.id}>
                    {isNewDay ? (
                      <tr className='finance-day-separator-row'>
                        <td colSpan={8} className='finance-day-separator-cell'>
                          {formatTransactionDayLabel(transaction.transactionDate)}
                        </td>
                      </tr>
                    ) : null}
                    <tr className={isCancelled ? 'finance-transaction-row-cancelled' : undefined}>
                      <td>{formatDateDdMmYyyy(transaction.transactionDate)}</td>
                      <td className={`finance-transaction-type finance-transaction-type-${transaction.type}`}>
                        {transactionLabels[transaction.type]}
                        {isCancelled ? (
                          <span className='finance-transaction-badge finance-transaction-badge-cancelled'>
                            Cancelled
                          </span>
                        ) : null}
                        {isCancellation ? (
                          <span className='finance-transaction-badge finance-transaction-badge-cancellation'>
                            Cancellation
                          </span>
                        ) : null}
                      </td>
                      <td>{formatMoney(transaction.amount, transaction.currency)}</td>
                      <td>
                        {balanceAfterByTransactionId[transaction.id] === null ||
                        balanceAfterByTransactionId[transaction.id] === undefined
                          ? '-'
                          : formatMoney(
                              balanceAfterByTransactionId[
                                transaction.id
                              ] as number,
                              transaction.currency,
                            )}
                      </td>
                      <td>{transaction.fromCashbox?.name ?? '-'}</td>
                      <td>{transaction.toCashbox?.name ?? '-'}</td>
                      <td>
                        {(() => {
                          const normalizedNote = transaction.note.trim();
                          const parsedOrderNumber =
                            normalizedNote.match(/order\s+([A-Za-z0-9-]+)/i)?.[1] ?? '';
                          const parsedOrderNumberNormalized = parsedOrderNumber.toLowerCase();
                          const matchedSale = sales.find(
                            (sale) =>
                              (sale.recordNumber ?? '').toLowerCase() === parsedOrderNumberNormalized ||
                              sale.id.toLowerCase() === parsedOrderNumberNormalized,
                          );
                          if (matchedSale) {
                            return (
                              <button
                                type='button'
                                className='catalog-name-button'
                                onClick={() =>
                                  onOpenSaleCard({ id: matchedSale.id, kind: matchedSale.kind })
                                }
                              >
                                {transaction.note}
                              </button>
                            );
                          }
                          const matchedOrder = supplierOrders.find(
                            (order) =>
                              order.number === parsedOrderNumber ||
                              order.orderBaseId === parsedOrderNumber,
                          );
                          if (!matchedOrder) return transaction.note || '-';
                          return (
                            <button
                              type='button'
                              className='catalog-name-button'
                              onClick={() => setSelectedSupplierOrder(matchedOrder)}
                            >
                              {transaction.note}
                            </button>
                          );
                        })()}
                      </td>
                      <td className='finance-transaction-action-cell'>
                        {canCancelTransfer ? (
                          <button
                            type='button'
                            className='toolbar-filter-button finance-transaction-cancel-button'
                            onClick={() => setTransferToCancel(transaction)}
                          >
                            Cancel transfer
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  </Fragment>
                );
              })            )}
          </tbody>
        </table>
      </div>
      <PaginationPanel
        totalItems={filteredTransactions.length}
        page={transactionsPage}
        pageSize={transactionsPageSize}
        onPageChange={setTransactionsPage}
        onPageSizeChange={(nextPageSize) => {
          setTransactionsPageSize(nextPageSize);
          setTransactionsPage(1);
        }}
      />
    </>
  );

  const renderSupplierOrdersQueue = () => (
    <section className='finance-orders-view'>
      <div className='finance-information-header finance-orders-header'>
        <div>
          <p className='section-label'>Supplier payments</p>
          <h2>Orders payment queue</h2>
        </div>
        <div className='finance-information-status'>
          <span>{`${financeOverview.pendingSupplierCount} waiting`}</span>
          <span>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</span>
        </div>
      </div>

      <div className='finance-orders-summary-grid'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Queue amount</span>
          <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Orders waiting</span>
          <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Active cashboxes</span>
          <strong>{formatMetric(financeOverview.activeCashboxCount)}</strong>
        </article>
      </div>

      <div className='orders-table-wrap finance-orders-table-wrap'>
        <table className='orders-table finance-orders-table'>
          <thead>
            <tr>
              <th className='finance-orders-col-number'>Order</th>
              <th className='finance-orders-col-date'>Date</th>
              <th className='finance-orders-col-supplier'>Supplier</th>
              <th className='finance-orders-col-amount'>Amount</th>
              <th className='finance-orders-col-payment'>Payment</th>
            </tr>
          </thead>
          <tbody>
            {supplierOrdersQueue.length === 0 ? (
              <tr>
                <td colSpan={5} className='orders-empty finance-orders-empty'>
                  No orders are waiting for payment.
                </td>
              </tr>
            ) : (
              supplierOrdersQueue.map((order) => {
                const cashboxId = transactionForm.fromCashboxId || firstCashboxId;
                const orderNumber = getSupplierOrderDisplayNumber(order);
                const fullOrder = supplierOrders.find((supplierOrder) =>
                  supplierOrder.id === order.id ||
                  supplierOrder.orderBaseId === order.orderBaseId ||
                  supplierOrder.number === order.number,
                );
                return (
                  <tr key={order.id} className='finance-orders-row'>
                    <td className='finance-orders-number-cell' title={orderNumber}>
                      <button
                        type='button'
                        className='finance-orders-number-button'
                        onClick={() => {
                          if (fullOrder) {
                            setSelectedSupplierOrder(fullOrder);
                          }
                        }}
                        disabled={!fullOrder}
                        aria-label={`Open supplier order ${orderNumber}`}
                      >
                        {orderNumber}
                      </button>
                      <span className='finance-orders-cell-note'>Supplier order</span>
                    </td>
                    <td className='finance-orders-date-cell'>
                      <span>{formatDateDdMmYyyy(order.deliveryDate || order.createdAt)}</span>
                      <small>{order.deliveryDate ? 'Delivery' : 'Created'}</small>
                    </td>
                    <td className='finance-orders-supplier-cell'>
                      <span className='orders-table-cell-truncate'>{order.supplierName}</span>
                      <small>Payment required</small>
                    </td>
                    <td className='finance-orders-amount-cell'>
                      <strong>{formatMoney(order.total, 'UAH')}</strong>
                    </td>
                    <td className='finance-orders-payment-cell'>
                      <div className='finance-orders-payment-actions'>
                        {canPaySupplierOrders ? (
                          <>
                            <label className='finance-orders-cashbox-select'>
                              <span>Cashbox</span>
                              <select value={cashboxId} onChange={(event) => setTransactionForm((current) => ({ ...current, fromCashboxId: event.target.value }))}>
                                {cashboxes.map((cashbox) => (
                                  <option key={cashbox.id} value={cashbox.id} title={cashbox.name}>
                                    {truncateLabel(cashbox.name, 14)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button
                              type='button'
                              className='primary-button'
                              disabled={isSaving || !cashboxId}
                              onClick={async () => {
                                if (!cashboxId) return;
                                setIsSaving(true);
                                try {
                                  await paySupplierOrder(order.id, { cashboxId, note: `Payment for order ${orderNumber}` });
                                  onSuccess('Order has been paid.');
                                  window.dispatchEvent(new Event('project-goods:finance-updated'));
                                  await refreshFinance();
                                } catch (error) {
                                  onError(error instanceof Error ? error.message : 'Failed to pay order.');
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                            >
                              Pay
                            </button>
                          </>
                        ) : null}
                        {canIssueSupplierOrdersWithoutPayment ? (
                          <button
                            type='button'
                            className='secondary-button'
                            disabled={isSaving}
                            onClick={() => setWithoutPaymentOrder(order)}
                          >
                            Issue without payment
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  const renderReports = () => (
    <section className='finance-information'>
      <div className='finance-information-header'>
        <div>
          <p className='section-label'>Finance overview</p>
          <h2>Accounting information</h2>
        </div>
        <div className='finance-information-status'>
          <span>{`${financeOverview.activeCashboxCount} active cashboxes`}</span>
          {financeOverview.archivedCashboxCount > 0 ? (
            <span>{`${financeOverview.archivedCashboxCount} archived`}</span>
          ) : null}
        </div>
      </div>

      <div className='finance-report-grid finance-report-grid-wide'>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Transactions</span>
          <strong>{formatMetric(financeOverview.transactionCount)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Today operations</span>
          <strong>{formatMetric(financeOverview.todayTransactionCount)}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Pending supplier payments</span>
          <strong>{formatMoney(financeOverview.pendingSupplierTotal, 'UAH')}</strong>
        </article>
        <article className='analytics-summary-card'>
          <span className='metric-label'>Payment queue</span>
          <strong>{formatMetric(financeOverview.pendingSupplierCount)}</strong>
        </article>
      </div>

      <div className='finance-information-grid'>
        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>Balances</p>
              <h3>Currency totals</h3>
            </div>
          </div>
          <div className='finance-currency-overview'>
            {financeOverview.currencyRows.length === 0 ? (
              <p className='empty-state'>No balances yet.</p>
            ) : (
              financeOverview.currencyRows.map((row) => (
                <div key={row.currency} className='finance-currency-row'>
                  <div>
                    <span className='metric-label'>{row.currency}</span>
                    <strong>{formatMoney(row.total, row.currency)}</strong>
                  </div>
                  <span>{`Today ${formatMoney(row.todayTurnover, row.currency)}`}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className='finance-info-panel'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>Turnover</p>
              <h3>Today split</h3>
            </div>
          </div>
          <div className='finance-turnover-split'>
            {([
              ['deposit', 'Deposits'],
              ['withdraw', 'Withdrawals'],
              ['transfer', 'Transfers'],
            ] as Array<[FinanceTransactionType, string]>).map(([type, label]) => (
              <div key={type} className={`finance-turnover-item finance-turnover-${type}`}>
                <span>{label}</span>
                <strong>{formatCurrencyTotals(financeOverview.todayByType[type])}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className='finance-info-panel finance-info-panel-wide'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>Cashboxes</p>
              <h3>Distribution</h3>
            </div>
          </div>
          <div className='finance-cashbox-distribution'>
            {financeOverview.currencyRows.flatMap((row) =>
              row.cashboxes.map((cashbox) => {
                const share = row.total > 0 ? (cashbox.balance / row.total) * 100 : 0;
                return (
                  <div key={`${row.currency}-${cashbox.id}`} className='finance-distribution-row'>
                    <div>
                      <span title={cashbox.name}>{cashbox.name}</span>
                      <strong>{formatMoney(cashbox.balance, row.currency)}</strong>
                    </div>
                    <div className='finance-distribution-track'>
                      <span style={{ width: `${Math.max(Math.min(share, 100), 2)}%` }} />
                    </div>
                    <small>{formatPercent(share)}</small>
                  </div>
                );
              }),
            )}
          </div>
        </section>

        <section className='finance-info-panel finance-info-panel-wide'>
          <div className='analytics-panel-header'>
            <div>
              <p className='section-label'>Activity</p>
              <h3>Recent operations</h3>
            </div>
          </div>
          <div className='finance-recent-list'>
            {financeOverview.recentTransactions.length === 0 ? (
              <p className='empty-state'>No finance operations yet.</p>
            ) : (
              financeOverview.recentTransactions.map((transaction) => (
                <div key={transaction.id} className='finance-recent-row'>
                  <span className={`finance-transaction-type finance-transaction-type-${transaction.type}`}>
                    {transactionLabels[transaction.type]}
                  </span>
                  <div>
                    <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
                    <p>
                      {[
                        transaction.fromCashbox?.name,
                        transaction.toCashbox?.name,
                      ]
                        .filter(Boolean)
                        .join(' -> ') || transaction.note || 'Manual operation'}
                    </p>
                  </div>
                  <time>{formatDateDdMmYyyy(transaction.transactionDate)}</time>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );

  const renderFinanceSettings = () => (
    <AccountingFinanceSettings
      activeTab={financeSettingsTab}
      allCashboxes={allCashboxes}
      allCurrencyCodes={allCurrencyCodes}
      editingCashboxId={editingCashboxId}
      editingCashboxName={editingCashboxName}
      expandedCard={expandedFinanceSettingsCard}
      isSaving={isSaving}
      newCashboxName={newCashboxName}
      newCurrencyCode={newCurrencyCode}
      getCurrencyBalance={getCurrencyBalance}
      isCashboxCurrencyActive={isCashboxCurrencyActive}
      isGlobalCurrencyActive={isGlobalCurrencyActive}
      onAddCurrency={addCurrencyCode}
      onCancelCashboxEdit={() => {
        setEditingCashboxId(null);
        setEditingCashboxName('');
      }}
      onCreateCashbox={handleCreateCashbox}
      onEditingCashboxNameChange={setEditingCashboxName}
      onNewCashboxNameChange={setNewCashboxName}
      onNewCurrencyCodeChange={setNewCurrencyCode}
      onRemoveCurrency={handleRemoveCurrency}
      onSaveCashbox={saveCashbox}
      onStartEditCashbox={startEditCashbox}
      onTabChange={(tab) => {
        setFinanceSettingsTab(tab);
        setExpandedFinanceSettingsCard(null);
      }}
      onToggleCard={toggleFinanceSettingsCard}
      onToggleCashboxArchived={toggleCashboxArchived}
      onToggleCashboxCurrencyActivity={toggleCashboxCurrencyActivity}
      onToggleCurrencyActivity={toggleCurrencyActivity}
    />
  );

  return (
    <section className='orders-page finance-page'>
      <div className='finance-tabs-row'>
        <div className='orders-tabs' role='tablist' aria-label='Accounting sections'>
          {[
            ['cashboxes', 'Cashboxes'],
            ['transactions', 'Transactions'],
            ['orders', 'Orders'],
            ['reports', 'Information'],
          ].map(([key, label]) => (
            <button
              key={key}
              type='button'
              className={activeTab === key ? 'orders-tab orders-tab-active' : 'orders-tab'}
              onClick={() => {
                setIsFinanceSettingsOpen(false);
                setExpandedFinanceSettingsCard(null);
                setActiveTab(key as AccountingTab);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {canManageCashboxes ? <div className='toolbar-settings'>
          <button
            type='button'
            className='toolbar-square-button'
            aria-label='Accounting settings'
            aria-expanded={isFinanceSettingsOpen}
            onClick={() =>
              setIsFinanceSettingsOpen((current) => {
                const next = !current;
                if (next) {
                  setExpandedFinanceSettingsCard(null);
                  setEditingCashboxId(null);
                  setEditingCashboxName('');
                }
                return next;
              })
            }
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              viewBox='0 0 24 24'
              className='toolbar-square-button-icon'
              fill='currentColor'
            >
              <path d='M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65A.5.5 0 0 0 14 2h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.63.25-1.21.57-1.75.95l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.33.68.22l2.49-1c.54.38 1.12.7 1.75.95l.38 2.65c.04.27.26.47.49.47h4c.27 0 .5-.2.54-.47l.38-2.65c.63-.25 1.21-.57 1.75-.95l2.49 1c.26.11.54.02.68-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z' />
            </svg>
          </button>
        </div> : null}
      </div>

      {isLoading ? (
        <p className='empty-state'>Loading finance data...</p>
      ) : isFinanceSettingsOpen ? (
        renderFinanceSettings()
      ) : activeTab === 'transactions' ? (
        renderTransactions()
      ) : activeTab === 'orders' ? (
        renderSupplierOrdersQueue()
      ) : activeTab === 'reports' ? (
        renderReports()
      ) : (
        renderCashboxes()
      )}
      <SupplierOrderModal
        isOpen={Boolean(selectedSupplierOrder)}
        suppliers={[]}
        editingOrder={selectedSupplierOrder}
        forceReadOnly
        onClose={() => setSelectedSupplierOrder(null)}
        onCreateSupplier={async () => false}
        onSubmit={async () => undefined}
        onSuccess={onSuccess}
        onError={onError}
      />
      {transferToCancel ? (
        <CancelTransferModal
          isSaving={isSaving}
          transfer={transferToCancel}
          onClose={() => setTransferToCancel(null)}
          onConfirm={handleCancelTransfer}
        />
      ) : null}
      {withoutPaymentOrder ? (
        <IssueWithoutPaymentModal
          isSaving={isSaving}
          order={withoutPaymentOrder}
          onClose={() => setWithoutPaymentOrder(null)}
          onConfirm={handleIssueWithoutPayment}
        />
      ) : null}
    </section>
  );
};
