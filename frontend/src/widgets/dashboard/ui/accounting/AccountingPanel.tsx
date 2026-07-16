import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../shared/i18n/config';
import {
  useCancelFinanceTransactionMutation,
  useCreateCashboxMutation,
  useCreateFinanceCurrencyMutation,
  useCreateFinanceTransactionMutation,
  useIssueSupplierOrderWithoutPaymentMutation,
  usePaySupplierOrderMutation,
  useUpdateCashboxMutation,
  useUpdateFinanceCurrencyMutation,
  useUpdateFinanceTransactionMutation,
} from '../../../../entities/finance/api/financeApi';
import type {
  Cashbox,
  FinanceCurrency,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import { hasEmployeePermission } from '../../../../entities/employee/model/permissions';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import {
  canCancelAccountingTransaction,
  getAccountingCashboxCurrencyRows,
  getAccountingTotals,

  getFinanceOverview,
  type AccountingTab,
} from '../../model/accounting';
import { AccountingCashboxesView } from './AccountingCashboxesView';
import {
  CancelTransactionModal,
  IssueWithoutPaymentModal,
} from './AccountingConfirmModals';
import { AccountingFinanceSettings } from './AccountingFinanceSettings';
import { AccountingReportsView } from './AccountingReportsView';
import { AccountingSupplierOrdersQueue } from './AccountingSupplierOrdersQueue';
import { AccountingTabs } from './AccountingTabs';
import { AccountingTransactionsView } from './AccountingTransactionsView';
import { SupplierOrderModal } from '../orders/modals/SupplierOrderModal';
import { useAccountingFinanceData } from './useAccountingFinanceData';
import { useAccountingPreferences } from './useAccountingPreferences';
import { useFinanceAction } from './useFinanceAction';
import { useTransactionFilters } from './useTransactionFilters';
import { useTransactionForm } from './useTransactionForm';
import { getSupplierOrderDisplayNumber } from '../../model/supplier-order-utils';
import { Modal } from '../../../../shared/ui/Modal';
import { Button } from '../../../../shared/ui/Button';

type AccountingPanelProps = {
  currentEmployee: Employee | null;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  sales: Sale[];
  onNavigateAccountingTab?: (tab: AccountingTab) => void;
  registerAccountingPopstateSync?: (
    sync: ((tab: AccountingTab | null) => void) | null,
  ) => void;
  syncedAccountingTab?: AccountingTab | null;
};

export const AccountingPanel = ({
  currentEmployee,
  onError,
  onSuccess,
  sales,
  onNavigateAccountingTab,
  registerAccountingPopstateSync,
  syncedAccountingTab = null,
}: AccountingPanelProps) => {
  const { t } = useTranslation();
  const {
    allCashboxes,
    cashboxes,
    currencies,
    isCashboxesOrderHydrated,
    isLoading,
    refreshFinance,
    report,
    setCashboxes,
    supplierOrders,
    supplierOrdersQueue,
    recentTransactions,
  } = useAccountingFinanceData({ onError });
  const {
    activeTab,
    expandedFinanceSettingsCard,
    financeSettingsTab,
    isFinanceSettingsOpen,
    lastOperationByCashbox,
    setActiveTab,
    setExpandedFinanceSettingsCard,
    setFinanceSettingsTab,
    setIsFinanceSettingsOpen,
    setLastOperationByCashbox,
  } = useAccountingPreferences({
    cashboxes,
    isCashboxesOrderHydrated,
    onNavigateAccountingTab,
    registerPopstateSync: registerAccountingPopstateSync,
    syncedAccountingTab,
  });

  const [selectedSupplierOrder, setSelectedSupplierOrder] =
    useState<SupplierOrder | null>(null);
  const [transactionToCancel, setTransactionToCancel] =
    useState<FinanceTransaction | null>(null);
  const [withoutPaymentOrder, setWithoutPaymentOrder] =
    useState<SupplierOrderPaymentQueueItem | null>(null);
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null);
  const [newCashboxName, setNewCashboxName] = useState('');
  const [isTransactionsFilterOpen, setIsTransactionsFilterOpen] =
    useState(false);
  const [isTransactionsDateFilterOpen, setIsTransactionsDateFilterOpen] =
    useState(false);
  const [draggedCashboxId, setDraggedCashboxId] = useState<string | null>(null);
  const [editingCashboxId, setEditingCashboxId] = useState<string | null>(null);
  const [editingCashboxName, setEditingCashboxName] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');

  const [noteTransactionToEdit, setNoteTransactionToEdit] =
    useState<FinanceTransaction | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const createCashboxMutation = useCreateCashboxMutation();
  const updateCashboxMutation = useUpdateCashboxMutation();
  const createFinanceCurrencyMutation = useCreateFinanceCurrencyMutation();
  const updateFinanceCurrencyMutation = useUpdateFinanceCurrencyMutation();
  const createFinanceTransactionMutation =
    useCreateFinanceTransactionMutation();
  const cancelFinanceTransactionMutation =
    useCancelFinanceTransactionMutation();
  const paySupplierOrderMutation = usePaySupplierOrderMutation();
  const issueSupplierOrderWithoutPaymentMutation =
    useIssueSupplierOrderWithoutPaymentMutation();
  const updateFinanceTransactionMutation = useUpdateFinanceTransactionMutation();

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

  const allCurrencyCodes = useMemo(
    () => currencies.map((currency) => currency.code),
    [currencies],
  );
  const isGlobalCurrencyActive = useCallback(
    (currencyCode: string) =>
      currencyCode === 'UAH' ||
      currencies.find((currency) => currency.code === currencyCode)?.isArchived !== true,
    [currencies],
  );
  const isCashboxCurrencyActive = useCallback(
    (cashboxId: string, currencyCode: string) => {
      if (currencyCode === 'UAH') return true;
      const cashbox = allCashboxes.find((item) => item.id === cashboxId);
      return cashbox?.enabledCurrencies?.[currencyCode] === true;
    },
    [allCashboxes],
  );
  const getCurrencyBalance = useCallback(
    (cashbox: Cashbox, currencyCode: string) =>
      cashbox.balances[currencyCode as FinanceCurrency] ?? 0,
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

  const { isSaving, run: runFinanceAction } = useFinanceAction({
    onError,
    onSuccess,
    refresh: refreshFinance,
  });

  const {
    draftTransactionFilters,
    setDraftTransactionFilters,
    appliedTransactionFilters,
    setAppliedTransactionFilters,
    transactionsPage,
    setTransactionsPage,
    transactionsPageSize,
    setTransactionsPageSize,
    selectedTransactionCashboxId,
    setSelectedTransactionCashboxId,
    transactions,
    transactionsTotal,
    balanceAfterByTransactionId,
    activeTransactionFiltersCount,
    isTransactionsLoading,
  } = useTransactionFilters({ enabled: activeTab === 'transactions' });

  const {
    transactionForm,
    setTransactionForm,
    allowedTransactionCurrencies,
    handleTransactionTypeChange,
    startForCashbox,
    handleCreateTransaction: handleCreateTransactionFromHook,
    firstCashboxId: hookFirstCashboxId,
    // secondCashboxId is computed and used internally by the hook; not needed here
  } = useTransactionForm({
    cashboxes,
    allCurrencyCodes,
    getCurrencyBalance,
    isCashboxCurrencyActive,
    isGlobalCurrencyActive,
    lastOperationByCashbox,
    setLastOperationByCashbox,
    permittedTransactionTypes,
    runFinanceAction,
    createFinanceTransaction: createFinanceTransactionMutation.mutateAsync,
    onError,
    isSaving,
  });

  const firstCashboxId = hookFirstCashboxId || cashboxes[0]?.id || '';

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
        transactions: recentTransactions,
      }),
    [
      allCashboxes,
      allCurrencyCodes,
      cashboxes,
      getCurrencyBalance,
      isGlobalCurrencyActive,
      report,
      recentTransactions,
      supplierOrdersQueue,
    ],
  );
  // Transaction form + filters (incl. filteredTransactions, paginated, active count) now provided by useTransactionFilters hook
  // Transaction form + filters now provided by hooks (useTransactionForm / useTransactionFilters)
  // startTransaction wraps hook's start + ensures cashboxes tab (form is shown there)
  const startTransaction = useCallback(
    (type: FinanceTransactionType, cashbox: Cashbox) => {
      startForCashbox(type, cashbox);
      setActiveTab('cashboxes');
    },
    [startForCashbox, setActiveTab],
  );

  const openCashboxTransactions = useCallback(
    (cashbox: Cashbox) => {
      setActiveTab('transactions');
      setSelectedTransactionCashboxId(cashbox.id);
      setTransactionsPage(1);
    },
    [setActiveTab, setSelectedTransactionCashboxId, setTransactionsPage],
  );

  const startEditCashbox = useCallback(
    (cashbox: Cashbox) => {
      setEditingCashboxId(cashbox.id);
      setEditingCashboxName(cashbox.name);
    },
    [setEditingCashboxId, setEditingCashboxName],
  );

  const saveCashbox = async () => {
    if (!editingCashboxId) return;
    if (!canManageCashboxes) {
      onError(i18n.t('accounting.messages.errors.noPermissionManageCashboxes'));
      return;
    }
    await runFinanceAction(
      () =>
        updateCashboxMutation.mutateAsync({
          cashboxId: editingCashboxId,
          payload: { name: editingCashboxName.trim() },
        }),
      i18n.t('accounting.messages.success.cashboxUpdated'),
      {
        afterSuccess: () => {
          setEditingCashboxId(null);
          setEditingCashboxName('');
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedUpdateCashbox'),
      },
    );
  };

  const toggleCashboxArchived = async (cashbox: Cashbox) => {
    if (!canManageCashboxes) {
      onError(i18n.t('accounting.messages.errors.noPermissionManageCashboxes'));
      return;
    }
    const nextArchived = !cashbox.isArchived;
    await runFinanceAction(
      () =>
        updateCashboxMutation.mutateAsync({
          cashboxId: cashbox.id,
          payload: { isArchived: nextArchived },
        }),
      nextArchived
        ? i18n.t('accounting.messages.success.cashboxDeactivated')
        : i18n.t('accounting.messages.success.cashboxReactivated'),
      {
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedUpdateCashboxStatus'),
      },
    );
  };

  const addCurrencyCode = async () => {
    const normalized = newCurrencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3,6}$/.test(normalized)) {
      onError(i18n.t('accounting.messages.errors.currencyCodeInvalid'));
      return;
    }
    if (currencies.some((currency) => currency.code === normalized && !currency.isArchived)) {
      onError(i18n.t('accounting.messages.errors.currencyAlreadyExists'));
      return;
    }
    await runFinanceAction(
      () => createFinanceCurrencyMutation.mutateAsync({ code: normalized }),
      i18n.t('accounting.messages.success.currencyCreated'),
      {
        afterSuccess: () => {
          setNewCurrencyCode('');
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedCreateCurrency'),
      },
    );
  };

  const handleRemoveCurrency = useCallback(
    (code: string) => {
      if (code === 'UAH') {
        onError(i18n.t('accounting.messages.errors.uahCannotBeArchived'));
        return;
      }
      void runFinanceAction(
        () =>
          updateFinanceCurrencyMutation.mutateAsync({
            currencyCode: code,
            payload: { isArchived: true },
          }),
        i18n.t('accounting.messages.success.currencyArchived'),
        {
          skipRefresh: true,
          errorFallback: i18n.t('accounting.messages.errors.failedArchiveCurrency'),
        },
      );
    },
    [onError, runFinanceAction, updateFinanceCurrencyMutation],
  );

  const toggleFinanceSettingsCard = useCallback(
    (cardId: string) => {
      setExpandedFinanceSettingsCard((current) =>
        current === cardId ? null : cardId,
      );
    },
    [setExpandedFinanceSettingsCard],
  );

  const toggleCurrencyActivity = async (currencyCode: string) => {
    if (currencyCode === 'UAH') {
      onError(i18n.t('accounting.messages.errors.uahAlwaysActive'));
      return;
    }
    const currency = currencies.find((item) => item.code === currencyCode);
    if (!currency) return;
    const nextArchived = !currency.isArchived;
    await runFinanceAction(
      () =>
        updateFinanceCurrencyMutation.mutateAsync({
          currencyCode,
          payload: { isArchived: nextArchived },
        }),
      nextArchived
        ? i18n.t('accounting.messages.success.currencyArchived')
        : i18n.t('accounting.messages.success.currencyRestored'),
      {
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedUpdateCurrency'),
      },
    );
  };

  const toggleCashboxCurrencyActivity = async (
    cashboxId: string,
    currencyCode: string,
  ) => {
    if (currencyCode === 'UAH') {
      onError(i18n.t('accounting.messages.errors.uahAlwaysActive'));
      return;
    }
    const cashbox = allCashboxes.find((item) => item.id === cashboxId);
    if (!cashbox) return;
    const nextEnabled = cashbox.enabledCurrencies?.[currencyCode] !== true;
    await runFinanceAction(
      () =>
        updateCashboxMutation.mutateAsync({
          cashboxId,
          payload: {
            enabledCurrencies: {
              ...cashbox.enabledCurrencies,
              UAH: true,
              [currencyCode]: nextEnabled,
            },
          },
        }),
      i18n.t('accounting.messages.success.cashboxCurrencySettingsUpdated'),
      {
        skipRefresh: true,
        errorFallback: i18n.t(
          'accounting.messages.errors.failedUpdateCashboxCurrencySettings',
        ),
      },
    );
  };

  const handleCreateCashbox = async () => {
    if (!newCashboxName.trim()) return;
    if (!canManageCashboxes) {
      onError(i18n.t('accounting.messages.errors.noPermissionManageCashboxes'));
      return;
    }
    await runFinanceAction(
      () => createCashboxMutation.mutateAsync({ name: newCashboxName }),
      i18n.t('accounting.messages.success.cashboxCreated'),
      {
        afterSuccess: () => {
          setNewCashboxName('');
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedCreateCashbox'),
      },
    );
  };

  const handleCreateTransaction = async () => {
    await handleCreateTransactionFromHook();
  };

  const canCancelTransaction = (transaction: FinanceTransaction) =>
    canCancelAccountingTransaction({
      canCreateDeposit,
      canCreateWithdraw,
      canCreateTransfer,
      transaction,
    });

  const handleCancelTransaction = async () => {
    const transaction = transactionToCancel!;
    if (!canCancelTransaction(transaction)) {
      onError(i18n.t('accounting.messages.errors.transactionCancelOnlySameDay'));
      setTransactionToCancel(null);
      return;
    }

    await runFinanceAction(
      () => cancelFinanceTransactionMutation.mutateAsync(transaction.id),
      i18n.t('accounting.messages.success.transactionCancelled'),
      {
        afterSuccess: () => {
          setTransactionToCancel(null);
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedCancelTransaction'),
      },
    );
  };

  const handleIssueWithoutPayment = async () => {
    const order = withoutPaymentOrder!;
    await runFinanceAction(
      () => issueSupplierOrderWithoutPaymentMutation.mutateAsync(order.id),
      i18n.t('accounting.messages.success.orderIssuedWithoutPayment'),
      {
        afterSuccess: () => {
          setWithoutPaymentOrder(null);
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedIssueWithoutPayment'),
      },
    );
  };

  const handlePaySupplierOrder = async (
    order: SupplierOrderPaymentQueueItem,
    cashboxId: string,
    orderNumber: string,
  ) => {
    if (!cashboxId || payingOrderId) return;
    const displayOrderNumber =
      orderNumber.trim() || getSupplierOrderDisplayNumber(order);
    setPayingOrderId(order.id);
    try {
      await runFinanceAction(
        () =>
          paySupplierOrderMutation.mutateAsync({
            supplierOrderId: order.id,
            payload: {
              cashboxId,
              note: i18n.t('accounting.orders.paymentNote', {
                orderNumber: displayOrderNumber,
              }),
            },
          }),
        i18n.t('accounting.messages.success.orderPaid'),
        {
          skipRefresh: true,
          errorFallback: i18n.t('accounting.messages.errors.failedPayOrder'),
        },
      );
    } finally {
      setPayingOrderId(null);
    }
  };

  const openNoteEditor = useCallback((transaction: FinanceTransaction) => {
    setNoteTransactionToEdit(transaction);
    setNoteDraft(transaction.note ?? '');
  }, []);

  const closeNoteEditor = useCallback(() => {
    setNoteTransactionToEdit(null);
    setNoteDraft('');
  }, []);

  const handleSaveNote = async () => {
    if (!noteTransactionToEdit) return;
    const payloadNote = noteDraft.trim();
    await runFinanceAction(
      () =>
        updateFinanceTransactionMutation.mutateAsync({
          transactionId: noteTransactionToEdit.id,
          payload: { note: payloadNote },
        }),
      i18n.t('accounting.messages.success.noteUpdated'),
      {
        afterSuccess: () => {
          closeNoteEditor();
        },
        skipRefresh: true,
        errorFallback: i18n.t('accounting.messages.errors.failedUpdateNote'),
      },
    );
  };

  const closeFinanceSettingsEditing = useCallback(() => {
    setExpandedFinanceSettingsCard(null);
    setEditingCashboxId(null);
    setEditingCashboxName('');
  }, [setExpandedFinanceSettingsCard, setEditingCashboxId, setEditingCashboxName]);

  const handleAccountingTabChange = useCallback(
    (tab: AccountingTab) => {
      setIsFinanceSettingsOpen(false);
      setExpandedFinanceSettingsCard(null);
      setActiveTab(tab);
    },
    [setIsFinanceSettingsOpen, setExpandedFinanceSettingsCard, setActiveTab],
  );

  const handleSettingsToggle = useCallback(() => {
    setIsFinanceSettingsOpen((current) => {
      const next = !current;
      if (next) {
        closeFinanceSettingsEditing();
      }
      return next;
    });
  }, [closeFinanceSettingsEditing, setIsFinanceSettingsOpen]);

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
        <p className='empty-state'>{t('accounting.transactions.loading')}</p>
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
          isDateFilterOpen={isTransactionsDateFilterOpen}
          isFilterOpen={isTransactionsFilterOpen}
          isLoading={isTransactionsLoading}
          page={transactionsPage}
          pageSize={transactionsPageSize}
          totalItems={transactionsTotal}
          transactions={transactions}
          sales={sales}
          selectedCashboxId={selectedTransactionCashboxId}
          supplierOrders={supplierOrders}
          canCancelTransaction={canCancelTransaction}
          onDateFilterOpenChange={setIsTransactionsDateFilterOpen}
          onFilterOpenChange={setIsTransactionsFilterOpen}
          onPageChange={setTransactionsPage}
          onPageSizeChange={(nextPageSize) => {
            setTransactionsPageSize(nextPageSize);
            setTransactionsPage(1);
          }}
          onSelectedCashboxIdChange={setSelectedTransactionCashboxId}
          onSelectedSupplierOrderChange={setSelectedSupplierOrder}
          onSetAppliedFilters={setAppliedTransactionFilters}
          onSetDraftFilters={setDraftTransactionFilters}
          onSetTransactionToCancel={setTransactionToCancel}
          onEditTransactionNote={openNoteEditor}
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
          payingOrderId={payingOrderId}
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
        key={selectedSupplierOrder?.id ?? 'closed'}
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
      {transactionToCancel ? (
        <CancelTransactionModal
          isSaving={isSaving}
          transaction={transactionToCancel}
          onClose={() => setTransactionToCancel(null)}
          onConfirm={handleCancelTransaction}
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
      {noteTransactionToEdit ? (
        <Modal
          isOpen
          title={t('accounting.transactions.noteModalTitle')}
          onClose={closeNoteEditor}
          closeLabel={t('common.close')}
          className="finance-note-modal"
          closeOnBackdrop={!isSaving}
          closeOnEscape={!isSaving}
          footer={
            <footer className="catalog-edit-footer">
              <Button
                variant="secondary"
                disabled={isSaving}
                onClick={closeNoteEditor}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={isSaving}
                onClick={() => void handleSaveNote()}
              >
                {isSaving
                  ? t('accounting.transactions.saving')
                  : t('common.save')}
              </Button>
            </footer>
          }
        >
          <textarea
            className="finance-note-textarea"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={4}
            maxLength={300}
            placeholder={t('accounting.transactions.noteModalPlaceholder')}
            disabled={isSaving}
          />
          <p className="muted-copy">{noteDraft.length}/300</p>
        </Modal>
      ) : null}
    </section>
  );
};
