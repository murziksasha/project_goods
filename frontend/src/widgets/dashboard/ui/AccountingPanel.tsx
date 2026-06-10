import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  cancelFinanceTransaction,
  createCashbox,
  createFinanceTransaction,
  issueSupplierOrderWithoutPayment,
  paySupplierOrder,
  updateCashbox,
} from '../../../entities/finance/api/financeApi';
import type {
  Cashbox,
  FinanceCurrency,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import { hasEmployeePermission } from '../../../entities/employee/model/permissions';
import type { Employee } from '../../../entities/employee/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  canCancelAccountingTransferTransaction,
  currencyOptions,
  filterFinanceTransactions,
  getAccountingCashboxCurrencyRows,
  getAccountingTotals,
  getActiveTransactionFiltersCount,
  getAllowedAccountingTransactionCurrencies,
  getBalanceAfterByTransactionId,
  getFinanceOverview,
  initialTransactionFilters,
  initialTransactionForm,
  paginateAccountingItems,
  type AccountingTab,
  type TransactionFilters,
} from '../model/accounting';
import { AccountingCashboxesView } from './AccountingCashboxesView';
import {
  CancelTransferModal,
  IssueWithoutPaymentModal,
} from './AccountingConfirmModals';
import { AccountingFinanceSettings } from './AccountingFinanceSettings';
import { AccountingReportsView } from './AccountingReportsView';
import { AccountingSupplierOrdersQueue } from './AccountingSupplierOrdersQueue';
import { AccountingTabs } from './AccountingTabs';
import { AccountingTransactionsView } from './AccountingTransactionsView';
import { SupplierOrderModal } from './SupplierOrderModal';
import { useAccountingFinanceData } from './useAccountingFinanceData';
import { useAccountingPreferences } from './useAccountingPreferences';

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
  const {
    allCashboxes,
    cashboxes,
    isCashboxesOrderHydrated,
    isLoading,
    refreshFinance,
    report,
    setCashboxes,
    supplierOrders,
    supplierOrdersQueue,
    transactions,
  } = useAccountingFinanceData({ onError });
  const {
    activeTab,
    allCurrencyCodes,
    cashboxCurrencyActivity,
    currencyActivity,
    customCurrencies,
    expandedFinanceSettingsCard,
    financeSettingsTab,
    isFinanceSettingsOpen,
    lastTargetCashboxByType,
    setActiveTab,
    setCashboxCurrencyActivity,
    setCurrencyActivity,
    setCustomCurrencies,
    setExpandedFinanceSettingsCard,
    setFinanceSettingsTab,
    setIsFinanceSettingsOpen,
    setLastTargetCashboxByType,
  } = useAccountingPreferences({
    allCashboxes,
    cashboxes,
    isCashboxesOrderHydrated,
  });

  const [selectedSupplierOrder, setSelectedSupplierOrder] =
    useState<SupplierOrder | null>(null);
  const [transferToCancel, setTransferToCancel] =
    useState<FinanceTransaction | null>(null);
  const [withoutPaymentOrder, setWithoutPaymentOrder] =
    useState<SupplierOrderPaymentQueueItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newCashboxName, setNewCashboxName] = useState('');
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [isTransactionsFilterOpen, setIsTransactionsFilterOpen] =
    useState(false);
  const [isTransactionsDateFilterOpen, setIsTransactionsDateFilterOpen] =
    useState(false);
  const [selectedTransactionCashboxId, setSelectedTransactionCashboxId] =
    useState('');
  const [draftTransactionFilters, setDraftTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [appliedTransactionFilters, setAppliedTransactionFilters] =
    useState<TransactionFilters>(initialTransactionFilters);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(30);
  const [draggedCashboxId, setDraggedCashboxId] = useState<string | null>(null);
  const [editingCashboxId, setEditingCashboxId] = useState<string | null>(null);
  const [editingCashboxName, setEditingCashboxName] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');

  const canManageCashboxes = hasEmployeePermission(
    currentEmployee,
    'finance.cashboxes.manage',
  );
  const canCreateDeposit = hasEmployeePermission(
    currentEmployee,
    'finance.transactions.deposit',
  );
  const canCreateWithdraw = hasEmployeePermission(
    currentEmployee,
    'finance.transactions.withdraw',
  );
  const canCreateTransfer = hasEmployeePermission(
    currentEmployee,
    'finance.transactions.transfer',
  );
  const canPaySupplierOrders = hasEmployeePermission(
    currentEmployee,
    'finance.supplierOrders.pay',
  );
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

  const isGlobalCurrencyActive = useCallback(
    (currencyCode: string) =>
      currencyCode === 'UAH' || currencyActivity[currencyCode] !== false,
    [currencyActivity],
  );
  const isCashboxCurrencyActive = useCallback(
    (cashboxId: string, currencyCode: string) => {
      if (currencyCode === 'UAH') return true;
      return cashboxCurrencyActivity[cashboxId]?.[currencyCode] ?? true;
    },
    [cashboxCurrencyActivity],
  );
  const getCurrencyBalance = useCallback(
    (cashbox: Cashbox, currencyCode: string) => {
      if (currencyOptions.includes(currencyCode as FinanceCurrency)) {
        return cashbox.balances[currencyCode as FinanceCurrency];
      }
      return 0;
    },
    [],
  );
  const cashboxCurrencyRows = useCallback(
    (cashbox: Cashbox) =>
      getAccountingCashboxCurrencyRows({
        allCurrencyCodes,
        cashbox,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive,
      }),
    [
      allCurrencyCodes,
      getCurrencyBalance,
      isCashboxCurrencyActive,
      isGlobalCurrencyActive,
    ],
  );

  const firstCashboxId = cashboxes[0]?.id ?? '';
  const secondCashboxId =
    cashboxes.find((cashbox) => cashbox.id !== firstCashboxId)?.id ?? '';

  const resolvePreferredTargetCashboxId = useCallback(
    (
      type: FinanceTransactionType,
      fromCashboxId: string,
      fallbackCashboxId: string,
      options?: {
        preferFallback?: boolean;
      },
    ) => {
      if (type === 'withdraw') return '';
      if (
        type === 'deposit' &&
        options?.preferFallback &&
        fallbackCashboxId &&
        cashboxes.some((cashbox) => cashbox.id === fallbackCashboxId)
      ) {
        return fallbackCashboxId;
      }
      const remembered =
        type === 'deposit' || type === 'transfer'
          ? lastTargetCashboxByType[type]
          : undefined;
      if (remembered && cashboxes.some((cashbox) => cashbox.id === remembered)) {
        if (type !== 'transfer' || remembered !== fromCashboxId) {
          return remembered;
        }
      }
      if (
        fallbackCashboxId &&
        cashboxes.some((cashbox) => cashbox.id === fallbackCashboxId)
      ) {
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

  const getAllowedTransactionCurrencies = useCallback(
    (
      type: FinanceTransactionType,
      fromCashboxId: string | undefined,
      toCashboxId: string | undefined,
    ) =>
      getAllowedAccountingTransactionCurrencies({
        allCurrencyCodes,
        cashboxes,
        fromCashboxId,
        getCurrencyBalance,
        isCashboxCurrencyActive,
        isGlobalCurrencyActive,
        toCashboxId,
        type,
      }),
    [
      allCurrencyCodes,
      cashboxes,
      getCurrencyBalance,
      isCashboxCurrencyActive,
      isGlobalCurrencyActive,
    ],
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

  const totals = useMemo(() => getAccountingTotals(cashboxes), [cashboxes]);
  const financeOverview = useMemo(
    () =>
      getFinanceOverview({
        allCashboxes,
        allCurrencyCodes,
        cashboxes,
        getCurrencyBalance,
        isGlobalCurrencyActive,
        report,
        supplierOrdersQueue,
        transactions,
      }),
    [
      allCashboxes,
      allCurrencyCodes,
      cashboxes,
      getCurrencyBalance,
      isGlobalCurrencyActive,
      report,
      supplierOrdersQueue,
      transactions,
    ],
  );
  const balanceAfterByTransactionId = useMemo(
    () => getBalanceAfterByTransactionId({ cashboxes, transactions }),
    [cashboxes, transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      filterFinanceTransactions({
        filters: appliedTransactionFilters,
        selectedCashboxId: selectedTransactionCashboxId,
        transactions,
      }),
    [appliedTransactionFilters, selectedTransactionCashboxId, transactions],
  );
  const paginatedTransactions = useMemo(
    () =>
      paginateAccountingItems(
        filteredTransactions,
        transactionsPage,
        transactionsPageSize,
      ),
    [filteredTransactions, transactionsPage, transactionsPageSize],
  );
  const activeTransactionFiltersCount = useMemo(
    () => getActiveTransactionFiltersCount(appliedTransactionFilters),
    [appliedTransactionFilters],
  );

  useEffect(() => {
    const pageCount = Math.max(
      1,
      Math.ceil(filteredTransactions.length / transactionsPageSize),
    );
    if (transactionsPage > pageCount) {
      setTransactionsPage(pageCount);
    }
  }, [filteredTransactions.length, transactionsPage, transactionsPageSize]);

  const startTransaction = (type: FinanceTransactionType, cashbox: Cashbox) => {
    if (!permittedTransactionTypes.includes(type)) {
      onError(
        'Current employee does not have permission for this finance operation.',
      );
      return;
    }
    const nextFromCashboxId =
      type === 'withdraw' || type === 'transfer' ? cashbox.id : '';
    const fallbackToCashboxId = type === 'deposit' ? cashbox.id : secondCashboxId;
    const nextToCashboxId = resolvePreferredTargetCashboxId(
      type,
      nextFromCashboxId,
      fallbackToCashboxId,
      {
        preferFallback: type === 'deposit',
      },
    );
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
        nextType === 'deposit' ? '' : current.fromCashboxId || firstCashboxId;
      const fallbackToCashboxId =
        nextType === 'deposit'
          ? current.toCashboxId || firstCashboxId
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
      onSuccess(
        cashbox.isArchived ? 'Cashbox reactivated.' : 'Cashbox deactivated.',
      );
      await refreshFinance();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Failed to update cashbox status.',
      );
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
    if (
      currencyOptions.includes(normalized as FinanceCurrency) ||
      customCurrencies.includes(normalized)
    ) {
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
      onError(
        'Cannot remove currency while active cashboxes have non-zero balance in it.',
      );
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
    setExpandedFinanceSettingsCard((current) =>
      current === cardId ? null : cardId,
    );
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

  const toggleCashboxCurrencyActivity = (
    cashboxId: string,
    currencyCode: string,
  ) => {
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
      onError(
        'Current employee does not have permission for this finance operation.',
      );
      return;
    }
    const normalizedAmount = transactionForm.amount.replace(',', '.').trim();
    if (!allowedTransactionCurrencies.includes(transactionForm.currency)) {
      onError('Selected currency is not available for this operation.');
      return;
    }
    if (
      !Number.isFinite(Number(normalizedAmount)) ||
      Number(normalizedAmount) <= 0
    ) {
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
        (transactionForm.type === 'deposit' ||
          transactionForm.type === 'transfer') &&
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
      onError(
        error instanceof Error ? error.message : 'Failed to save transaction.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const canCancelTransferTransaction = (transaction: FinanceTransaction) =>
    canCancelAccountingTransferTransaction({
      canCreateTransfer,
      transaction,
    });

  const handleCancelTransfer = async () => {
    if (!transferToCancel) return;
    if (!canCancelTransferTransaction(transferToCancel)) {
      onError('Transfer can be cancelled only during the transaction day.');
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
      onError(
        error instanceof Error ? error.message : 'Failed to cancel transfer.',
      );
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
      onError(
        error instanceof Error ? error.message : 'Failed to issue order without payment.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaySupplierOrder = async (
    order: SupplierOrderPaymentQueueItem,
    cashboxId: string,
    orderNumber: string,
  ) => {
    if (!cashboxId) return;
    setIsSaving(true);
    try {
      await paySupplierOrder(order.id, {
        cashboxId,
        note: `Payment for order ${orderNumber}`,
      });
      onSuccess('Order has been paid.');
      window.dispatchEvent(new Event('project-goods:finance-updated'));
      await refreshFinance();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to pay order.');
    } finally {
      setIsSaving(false);
    }
  };

  const closeFinanceSettingsEditing = () => {
    setExpandedFinanceSettingsCard(null);
    setEditingCashboxId(null);
    setEditingCashboxName('');
  };

  const handleAccountingTabChange = (tab: AccountingTab) => {
    setIsFinanceSettingsOpen(false);
    setExpandedFinanceSettingsCard(null);
    setActiveTab(tab);
  };

  const handleSettingsToggle = () => {
    setIsFinanceSettingsOpen((current) => {
      const next = !current;
      if (next) {
        closeFinanceSettingsEditing();
      }
      return next;
    });
  };

  return (
    <section className='orders-page finance-page'>
      <AccountingTabs
        activeTab={activeTab}
        canManageCashboxes={canManageCashboxes}
        isFinanceSettingsOpen={isFinanceSettingsOpen}
        onOpenSettings={handleSettingsToggle}
        onTabChange={handleAccountingTabChange}
      />

      {isLoading ? (
        <p className='empty-state'>Loading finance data...</p>
      ) : isFinanceSettingsOpen ? (
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
      ) : activeTab === 'transactions' ? (
        <AccountingTransactionsView
          activeFiltersCount={activeTransactionFiltersCount}
          allCurrencyCodes={allCurrencyCodes}
          appliedFilters={appliedTransactionFilters}
          balanceAfterByTransactionId={balanceAfterByTransactionId}
          cashboxes={cashboxes}
          draftFilters={draftTransactionFilters}
          filteredTransactions={filteredTransactions}
          isDateFilterOpen={isTransactionsDateFilterOpen}
          isFilterOpen={isTransactionsFilterOpen}
          page={transactionsPage}
          pageSize={transactionsPageSize}
          paginatedTransactions={paginatedTransactions}
          sales={sales}
          selectedCashboxId={selectedTransactionCashboxId}
          supplierOrders={supplierOrders}
          canCancelTransferTransaction={canCancelTransferTransaction}
          onDateFilterOpenChange={setIsTransactionsDateFilterOpen}
          onFilterOpenChange={setIsTransactionsFilterOpen}
          onOpenSaleCard={onOpenSaleCard}
          onPageChange={setTransactionsPage}
          onPageSizeChange={(nextPageSize) => {
            setTransactionsPageSize(nextPageSize);
            setTransactionsPage(1);
          }}
          onSelectedCashboxIdChange={setSelectedTransactionCashboxId}
          onSelectedSupplierOrderChange={setSelectedSupplierOrder}
          onSetAppliedFilters={setAppliedTransactionFilters}
          onSetDraftFilters={setDraftTransactionFilters}
          onSetTransferToCancel={setTransferToCancel}
        />
      ) : activeTab === 'orders' ? (
        <AccountingSupplierOrdersQueue
          canIssueSupplierOrdersWithoutPayment={
            canIssueSupplierOrdersWithoutPayment
          }
          canPaySupplierOrders={canPaySupplierOrders}
          cashboxes={cashboxes}
          financeOverview={financeOverview}
          firstCashboxId={firstCashboxId}
          isSaving={isSaving}
          supplierOrders={supplierOrders}
          supplierOrdersQueue={supplierOrdersQueue}
          transactionForm={transactionForm}
          onIssueWithoutPayment={setWithoutPaymentOrder}
          onPaySupplierOrder={handlePaySupplierOrder}
          onSelectedSupplierOrderChange={setSelectedSupplierOrder}
          onTransactionFormChange={setTransactionForm}
        />
      ) : activeTab === 'reports' ? (
        <AccountingReportsView financeOverview={financeOverview} />
      ) : (
        <AccountingCashboxesView
          allowedTransactionCurrencies={allowedTransactionCurrencies}
          canCreateDeposit={canCreateDeposit}
          canCreateTransfer={canCreateTransfer}
          canCreateWithdraw={canCreateWithdraw}
          canManageCashboxes={canManageCashboxes}
          cashboxes={cashboxes}
          cashboxCurrencyRows={cashboxCurrencyRows}
          draggedCashboxId={draggedCashboxId}
          isSaving={isSaving}
          newCashboxName={newCashboxName}
          permittedTransactionTypes={permittedTransactionTypes}
          totals={totals}
          transactionForm={transactionForm}
          onCreateCashbox={handleCreateCashbox}
          onCreateTransaction={handleCreateTransaction}
          onNewCashboxNameChange={setNewCashboxName}
          onOpenCashboxTransactions={openCashboxTransactions}
          onSetCashboxes={setCashboxes}
          onSetDraggedCashboxId={setDraggedCashboxId}
          onStartTransaction={startTransaction}
          onTransactionFormChange={setTransactionForm}
          onTransactionTypeChange={handleTransactionTypeChange}
        />
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
