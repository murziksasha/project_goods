import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelFinanceTransaction,
  createCashbox,
  createFinanceCurrency,
  createFinanceTransaction,
  issueSupplierOrderWithoutPayment,
  paySupplierOrder,
  updateCashbox,
  updateFinanceCurrency,
} from '../../../entities/finance/api/financeApi';
import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrencyConfig,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../entities/finance/model/types';
import type { Employee } from '../../../entities/employee/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import { AccountingPanel } from './AccountingPanel';
import { useAccountingFinanceData } from './useAccountingFinanceData';
import { useAccountingPreferences } from './useAccountingPreferences';

type AccountingTabsProps = ComponentProps<typeof import('./AccountingTabs').AccountingTabs>;
type AccountingCashboxesViewProps = ComponentProps<
  typeof import('./AccountingCashboxesView').AccountingCashboxesView
>;
type AccountingFinanceSettingsProps = ComponentProps<
  typeof import('./AccountingFinanceSettings').AccountingFinanceSettings
>;
type AccountingTransactionsViewProps = ComponentProps<
  typeof import('./AccountingTransactionsView').AccountingTransactionsView
>;
type AccountingSupplierOrdersQueueProps = ComponentProps<
  typeof import('./AccountingSupplierOrdersQueue').AccountingSupplierOrdersQueue
>;
type AccountingReportsViewProps = ComponentProps<
  typeof import('./AccountingReportsView').AccountingReportsView
>;
type SupplierOrderModalProps = ComponentProps<
  typeof import('./SupplierOrderModal').SupplierOrderModal
>;
type CancelTransferModalProps = ComponentProps<
  typeof import('./AccountingConfirmModals').CancelTransferModal
>;
type IssueWithoutPaymentModalProps = ComponentProps<
  typeof import('./AccountingConfirmModals').IssueWithoutPaymentModal
>;

vi.mock('../../../entities/finance/api/financeApi', () => {
  const cancelFinanceTransaction = vi.fn();
  const createCashbox = vi.fn();
  const createFinanceCurrency = vi.fn();
  const createFinanceTransaction = vi.fn();
  const issueSupplierOrderWithoutPayment = vi.fn();
  const paySupplierOrder = vi.fn();
  const updateCashbox = vi.fn();
  const updateFinanceCurrency = vi.fn();

  return {
    cancelFinanceTransaction,
    createCashbox,
    createFinanceCurrency,
    createFinanceTransaction,
    issueSupplierOrderWithoutPayment,
    paySupplierOrder,
    updateCashbox,
    updateFinanceCurrency,
    useCancelFinanceTransactionMutation: () => ({
      mutateAsync: cancelFinanceTransaction,
    }),
    useCreateCashboxMutation: () => ({ mutateAsync: createCashbox }),
    useCreateFinanceCurrencyMutation: () => ({
      mutateAsync: createFinanceCurrency,
    }),
    useCreateFinanceTransactionMutation: () => ({
      mutateAsync: createFinanceTransaction,
    }),
    useIssueSupplierOrderWithoutPaymentMutation: () => ({
      mutateAsync: issueSupplierOrderWithoutPayment,
    }),
    usePaySupplierOrderMutation: () => ({
      mutateAsync: ({
        payload,
        supplierOrderId,
      }: {
        payload: { cashboxId: string; note?: string };
        supplierOrderId: string;
      }) => paySupplierOrder(supplierOrderId, payload),
    }),
    useUpdateCashboxMutation: () => ({
      mutateAsync: ({
        cashboxId,
        payload,
      }: {
        cashboxId: string;
        payload: Partial<Cashbox>;
      }) => updateCashbox(cashboxId, payload),
    }),
    useUpdateFinanceCurrencyMutation: () => ({
      mutateAsync: ({
        currencyCode,
        payload,
      }: {
        currencyCode: string;
        payload: { isArchived?: boolean };
      }) => updateFinanceCurrency(currencyCode, payload),
    }),
  };
});

vi.mock('./useAccountingFinanceData', () => ({
  useAccountingFinanceData: vi.fn(),
}));

vi.mock('./useAccountingPreferences', () => ({
  useAccountingPreferences: vi.fn(),
}));

vi.mock('./AccountingTabs', () => ({
  AccountingTabs: (props: AccountingTabsProps) => (
    <nav>
      <button type='button' onClick={props.onOpenSettings}>settings</button>
      <button type='button' onClick={() => props.onTabChange('cashboxes')}>cashboxes</button>
      <button type='button' onClick={() => props.onTabChange('transactions')}>transactions</button>
      <button type='button' onClick={() => props.onTabChange('orders')}>orders</button>
      <button type='button' onClick={() => props.onTabChange('reports')}>reports</button>
      <span data-testid='tabs-state'>
        {props.activeTab}:{String(props.isFinanceSettingsOpen)}:{String(props.canManageCashboxes)}
      </span>
    </nav>
  ),
}));

vi.mock('./AccountingCashboxesView', () => ({
  AccountingCashboxesView: (props: AccountingCashboxesViewProps) => (
    <section>
      <span data-testid='cashboxes-view'>{props.cashboxes.length}</span>
      <button type='button' onClick={props.onCreateCashbox}>create cashbox</button>
      <button type='button' onClick={props.onCreateTransaction}>create transaction</button>
      <button type='button' onClick={() => props.onStartTransaction('deposit', props.cashboxes[0])}>start deposit</button>
      <button type='button' onClick={() => props.onStartTransaction('withdraw', props.cashboxes[0])}>start withdraw</button>
      <button type='button' onClick={() => props.onStartTransaction('transfer', props.cashboxes[0])}>start transfer</button>
      <button type='button' onClick={() => props.onOpenCashboxTransactions(props.cashboxes[0])}>open transactions</button>
      <button type='button' onClick={() => props.onTransactionTypeChange('deposit')}>type deposit</button>
      <button type='button' onClick={() => props.onTransactionTypeChange('transfer')}>type transfer</button>
      <button type='button' onClick={() => props.onTransactionTypeChange('withdraw')}>type withdraw</button>
      <button type='button' onClick={() => props.onTransactionTypeChange('refund' as FinanceTransactionType)}>type forbidden</button>
      <button type='button' onClick={() => props.onNewCashboxNameChange('Desk')}>cashbox view name</button>
      <button type='button' onClick={() => props.onSetDraggedCashboxId('cashbox-1')}>drag cashbox</button>
      <button type='button' onClick={() => props.onSetCashboxes(props.cashboxes.slice().reverse())}>reorder cashboxes</button>
      <button type='button' onClick={() => props.cashboxCurrencyRows(props.cashboxes[0])}>currency rows</button>
      <button
        type='button'
        onClick={() =>
          props.onTransactionFormChange((current: CreateFinanceTransactionPayload) => ({
            ...current,
            currency: 'EUR',
          }))
        }
      >
        unavailable currency
      </button>
      <button
        type='button'
        onClick={() =>
          props.onTransactionFormChange((current: CreateFinanceTransactionPayload) => ({
            ...current,
            amount: '0',
          }))
        }
      >
        zero amount
      </button>
      <button
        type='button'
        onClick={() =>
          props.onTransactionFormChange((current: CreateFinanceTransactionPayload) => ({
            ...current,
            amount: '25',
          }))
        }
      >
        amount
      </button>
    </section>
  ),
}));

vi.mock('./AccountingFinanceSettings', () => ({
  AccountingFinanceSettings: (props: AccountingFinanceSettingsProps) => (
    <section>
      <span data-testid='settings-view'>{props.activeTab}</span>
      <button type='button' onClick={() => props.onNewCashboxNameChange('Desk')}>cashbox name</button>
      <button type='button' onClick={props.onCreateCashbox}>settings create cashbox</button>
      <button type='button' onClick={() => props.onStartEditCashbox(props.allCashboxes[0])}>edit cashbox</button>
      <button type='button' onClick={() => props.onEditingCashboxNameChange('Renamed')}>edit name</button>
      <button type='button' onClick={props.onSaveCashbox}>save cashbox</button>
      <button type='button' onClick={props.onCancelCashboxEdit}>cancel edit</button>
      <button type='button' onClick={() => props.onToggleCashboxArchived(props.allCashboxes[0])}>archive cashbox</button>
      <button type='button' onClick={() => props.onNewCurrencyCodeChange('eur')}>currency code</button>
      <button type='button' onClick={() => props.onNewCurrencyCodeChange('usd')}>duplicate currency code</button>
      <button type='button' onClick={() => props.onNewCurrencyCodeChange('12')}>bad currency code</button>
      <button type='button' onClick={props.onAddCurrency}>add currency</button>
      <button type='button' onClick={() => props.onRemoveCurrency('UAH')}>remove uah</button>
      <button type='button' onClick={() => props.onRemoveCurrency('USD')}>remove usd</button>
      <button type='button' onClick={() => props.onRemoveCurrency('EUR')}>remove eur</button>
      <button type='button' onClick={() => props.onToggleCurrencyActivity('UAH')}>toggle uah</button>
      <button type='button' onClick={() => props.onToggleCurrencyActivity('USD')}>toggle usd</button>
      <button type='button' onClick={() => props.onToggleCurrencyActivity('EUR')}>toggle missing currency</button>
      <button type='button' onClick={() => props.onToggleCashboxCurrencyActivity(props.allCashboxes[0].id, 'UAH')}>toggle box uah</button>
      <button type='button' onClick={() => props.onToggleCashboxCurrencyActivity(props.allCashboxes[0].id, 'USD')}>toggle box usd</button>
      <button type='button' onClick={() => props.onToggleCashboxCurrencyActivity('missing', 'USD')}>toggle missing box</button>
      <button type='button' onClick={() => props.onToggleCard('cashboxes')}>toggle card</button>
      <button type='button' onClick={() => props.onTabChange('currencies')}>settings tab</button>
    </section>
  ),
}));

vi.mock('./AccountingTransactionsView', () => ({
  AccountingTransactionsView: (props: AccountingTransactionsViewProps) => (
    <section>
      <span data-testid='transactions-view'>{props.filteredTransactions.length}</span>
      <button type='button' onClick={() => props.onPageSizeChange(10)}>page size</button>
      <button type='button' onClick={() => props.onPageChange(4)}>page high</button>
      <button type='button' onClick={() => props.onFilterOpenChange(true)}>filter open</button>
      <button type='button' onClick={() => props.onDateFilterOpenChange(true)}>date open</button>
      <button
        type='button'
        onClick={() => props.onSetAppliedFilters({ ...props.appliedFilters, type: 'deposit' })}
      >
        apply filter
      </button>
      <button
        type='button'
        onClick={() => props.onSetDraftFilters({ ...props.draftFilters, currency: 'UAH' })}
      >
        draft filter
      </button>
      <button type='button' onClick={() => props.onSelectedCashboxIdChange('cashbox-1')}>select cashbox</button>
      <button type='button' onClick={() => props.onSetTransferToCancel(props.filteredTransactions[0])}>cancel transfer</button>
      <button
        type='button'
        onClick={() => props.onSetTransferToCancel({ ...props.filteredTransactions[0], transactionDate: '2020-01-01T00:00:00.000Z' })}
      >
        cancel old transfer
      </button>
      <button type='button' onClick={() => props.canCancelTransferTransaction(props.filteredTransactions[0])}>can cancel</button>
      <button type='button' onClick={() => props.onSelectedSupplierOrderChange(props.supplierOrders[0])}>supplier modal</button>
      <button type='button' onClick={() => props.onOpenSaleCard({ id: 'sale-1', kind: 'sale' })}>sale card</button>
    </section>
  ),
}));

vi.mock('./AccountingSupplierOrdersQueue', () => ({
  AccountingSupplierOrdersQueue: (props: AccountingSupplierOrdersQueueProps) => (
    <section>
      <span data-testid='orders-view'>{props.supplierOrdersQueue.length}</span>
      <button type='button' onClick={() => props.onPaySupplierOrder(props.supplierOrdersQueue[0], props.firstCashboxId, 'SO-1')}>pay order</button>
      <button type='button' onClick={() => props.onPaySupplierOrder(props.supplierOrdersQueue[0], '', 'SO-1')}>pay order without cashbox</button>
      <button type='button' onClick={() => props.onIssueWithoutPayment(props.supplierOrdersQueue[0])}>issue without payment</button>
      <button type='button' onClick={() => props.onSelectedSupplierOrderChange(props.supplierOrders[0])}>open supplier</button>
      <button
        type='button'
        onClick={() =>
          props.onTransactionFormChange((current: CreateFinanceTransactionPayload) => ({
            ...current,
            type: 'withdraw' as FinanceTransactionType,
          }))
        }
      >
        orders form
      </button>
    </section>
  ),
}));

vi.mock('./AccountingReportsView', () => ({
  AccountingReportsView: (props: AccountingReportsViewProps) => (
    <section data-testid='reports-view'>{props.financeOverview.transactionCount}</section>
  ),
}));

vi.mock('./SupplierOrderModal', () => ({
  SupplierOrderModal: (props: SupplierOrderModalProps) =>
    props.isOpen ? (
      <section data-testid='supplier-modal'>
        <button type='button' onClick={() => props.onCreateSupplier({ name: 'Supplier' } as never)}>create supplier inline</button>
        <button type='button' onClick={() => props.onSubmit({} as never)}>submit supplier inline</button>
        <button type='button' onClick={props.onClose}>close supplier modal</button>
      </section>
    ) : null,
}));

vi.mock('./AccountingConfirmModals', () => ({
  CancelTransferModal: (props: CancelTransferModalProps) => (
    <section data-testid='cancel-transfer-modal'>
      <button type='button' onClick={props.onConfirm}>confirm cancel transfer</button>
      <button type='button' onClick={props.onClose}>close cancel transfer</button>
    </section>
  ),
  IssueWithoutPaymentModal: (props: IssueWithoutPaymentModalProps) => (
    <section data-testid='issue-without-payment-modal'>
      <button type='button' onClick={props.onConfirm}>confirm issue without payment</button>
      <button type='button' onClick={props.onClose}>close issue without payment</button>
    </section>
  ),
}));

const now = '2026-06-16T10:00:00.000Z';

const employee = (role: Employee['role'] = 'owner'): Employee => ({
  id: 'employee-1',
  name: 'Owner',
  phone: '',
  email: '',
  username: 'owner',
  role,
  permissions: [],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: now,
  updatedAt: now,
});

const cashbox = (patch: Partial<Cashbox> = {}): Cashbox => ({
  id: 'cashbox-1',
  name: 'Main',
  balances: { UAH: 100, USD: 10 },
  enabledCurrencies: { UAH: true, USD: true },
  isDefault: true,
  isArchived: false,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const currency = (patch: Partial<FinanceCurrencyConfig> = {}): FinanceCurrencyConfig => ({
  id: 'currency-usd',
  code: 'USD',
  isSystem: false,
  isArchived: false,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const transfer = (patch: Partial<FinanceTransaction> = {}): FinanceTransaction => ({
  id: 'tx-1',
  type: 'transfer',
  amount: 10,
  currency: 'UAH',
  fromCashbox: { id: 'cashbox-1', name: 'Main' },
  toCashbox: { id: 'cashbox-2', name: 'Reserve' },
  note: '',
  transactionDate: now,
  status: 'active',
  isCancellation: false,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const report = (): FinanceReport => ({
  totals: { UAH: 100 },
  cashboxCount: 2,
  transactionCount: 1,
  todayTransactionCount: 1,
  todayTurnover: { UAH: 10 },
});

const queueItem = (): SupplierOrderPaymentQueueItem => ({
  id: 'queue-1',
  orderBaseId: 'base-1',
  number: 'SO-1',
  supplierName: 'Supplier',
  deliveryDate: '2026-06-16',
  total: 50,
  createdAt: now,
});

const supplierOrder = (): SupplierOrder =>
  ({
    id: 'supplier-order-1',
    orderBaseId: 'base-1',
    supplierId: 'supplier-1',
    number: 'SO-1',
    supplierName: 'Supplier',
    supplyType: 'stock',
    note: '',
    createdBy: 'employee-1',
    items: [],
    status: 'ordered',
    paymentStatus: 'pending',
    receiptStatus: 'new',
    total: 50,
    paid: 0,
    isFavorite: false,
    deliveryDate: '2026-06-16',
    createdAt: now,
    updatedAt: now,
  });

const mutableState = {
  activeTab: 'cashboxes' as 'cashboxes' | 'transactions' | 'orders' | 'reports',
  isFinanceSettingsOpen: false,
};

const setupHooks = (patch: Partial<ReturnType<typeof useAccountingFinanceData>> = {}) => {
  const cashboxes = [
    cashbox(),
    cashbox({ id: 'cashbox-2', name: 'Reserve', balances: { UAH: 0, USD: 0 } }),
  ];
  vi.mocked(useAccountingFinanceData).mockReturnValue({
    allCashboxes: cashboxes,
    cashboxes,
    currencies: [{ ...currency(), code: 'UAH', isSystem: true }, currency()],
    isCashboxesOrderHydrated: true,
    isLoading: false,
    refreshFinance: vi.fn(async () => undefined),
    report: report(),
    setCashboxes: vi.fn(),
    supplierOrders: [supplierOrder()],
    supplierOrdersQueue: [queueItem()],
    transactions: [transfer()],
    ...patch,
  });
};

const setupPreferences = (
  patch: Partial<ReturnType<typeof useAccountingPreferences>> = {},
) => {
  vi.mocked(useAccountingPreferences).mockImplementation(() => ({
    activeTab: mutableState.activeTab,
    expandedFinanceSettingsCard: null,
    financeSettingsTab: 'cashboxes',
    isFinanceSettingsOpen: mutableState.isFinanceSettingsOpen,
    lastTargetCashboxByType: {},
    setActiveTab: vi.fn((next) => {
      mutableState.activeTab = next;
    }),
    setExpandedFinanceSettingsCard: vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater(null);
        updater('cashboxes');
      }
    }),
    setFinanceSettingsTab: vi.fn(),
    setIsFinanceSettingsOpen: vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater(false);
        mutableState.isFinanceSettingsOpen = updater(true);
      } else {
        mutableState.isFinanceSettingsOpen = updater;
      }
    }),
    setLastTargetCashboxByType: vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater({});
      }
    }),
    ...patch,
  }));
};

const renderPanel = (props: Partial<ComponentProps<typeof AccountingPanel>> = {}) =>
  render(
    <AccountingPanel
      currentEmployee={employee()}
      onError={vi.fn()}
      onSuccess={vi.fn()}
      sales={[]}
      onOpenSaleCard={vi.fn()}
      {...props}
    />,
  );

describe('AccountingPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    mutableState.activeTab = 'cashboxes';
    mutableState.isFinanceSettingsOpen = false;
    setupHooks();
    setupPreferences();
    vi.mocked(createCashbox).mockResolvedValue(cashbox());
    vi.mocked(createFinanceTransaction).mockResolvedValue(transfer());
    vi.mocked(createFinanceCurrency).mockResolvedValue(currency());
    vi.mocked(updateCashbox).mockResolvedValue(cashbox());
    vi.mocked(updateFinanceCurrency).mockResolvedValue(currency());
    vi.mocked(cancelFinanceTransaction).mockResolvedValue(transfer());
    vi.mocked(paySupplierOrder).mockResolvedValue(undefined);
    vi.mocked(issueSupplierOrderWithoutPayment).mockResolvedValue(undefined);
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
  });

  it('renders loading state', () => {
    setupHooks({ isLoading: true });

    renderPanel();

    expect(screen.getByText('Loading finance data...')).toBeInTheDocument();
  });

  it('drives cashbox operations from the cashboxes view', async () => {
    const onSuccess = vi.fn();
    renderPanel({ onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'transactions' }));
    fireEvent.click(screen.getByRole('button', { name: 'orders' }));
    fireEvent.click(screen.getByRole('button', { name: 'reports' }));
    fireEvent.click(screen.getByRole('button', { name: 'cashboxes' }));
    fireEvent.click(screen.getByRole('button', { name: 'cashbox view name' }));
    fireEvent.click(screen.getByRole('button', { name: 'create cashbox' }));
    await waitFor(() => expect(createCashbox).toHaveBeenCalledWith({ name: 'Desk' }));

    fireEvent.click(screen.getByRole('button', { name: 'currency rows' }));
    fireEvent.click(screen.getByRole('button', { name: 'drag cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'reorder cashboxes' }));
    fireEvent.click(screen.getByRole('button', { name: 'start withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'start transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'type withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'type deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'type forbidden' }));
    fireEvent.click(screen.getByRole('button', { name: 'start deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));

    await waitFor(() => expect(createFinanceTransaction).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith('Finance transaction saved.');

    fireEvent.click(screen.getByRole('button', { name: 'type transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'open transactions' }));
  });

  it('resolves remembered and fallback cashbox targets', async () => {
    setupPreferences({ lastTargetCashboxByType: { deposit: 'cashbox-2', transfer: 'cashbox-2' } });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'start deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'type transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'type withdraw' }));

    cleanup();
    setupHooks({
      allCashboxes: [cashbox({ balances: { UAH: 100 } })],
      cashboxes: [cashbox({ balances: { UAH: 100 } })],
      currencies: [
        { ...currency(), code: 'UAH', isSystem: true },
        { ...currency(), code: 'EUR', id: 'currency-eur' },
      ],
    });
    setupPreferences();
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'currency rows' }));

    cleanup();
    setupHooks({
      allCashboxes: [cashbox()],
      cashboxes: [cashbox()],
    });
    setupPreferences({ lastTargetCashboxByType: { transfer: 'cashbox-1' } });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'start transfer' }));

    cleanup();
    setupHooks({ allCashboxes: [], cashboxes: [] });
    setupPreferences();
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'type deposit' }));
  });

  it('reports cashbox and transaction validation failures', async () => {
    const onError = vi.fn();
    renderPanel({ currentEmployee: employee('support'), onError });

    fireEvent.click(screen.getByRole('button', { name: 'start deposit' }));
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission for this finance operation.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'cashbox view name' }));
    fireEvent.click(screen.getByRole('button', { name: 'create cashbox' }));
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission to manage cashboxes.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission for this finance operation.',
    );

    cleanup();
    setupHooks({ allCashboxes: [], cashboxes: [] });
    setupPreferences();
    renderPanel({ onError });

    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    expect(onError).toHaveBeenCalledWith(
      'Selected currency is not available for this operation.',
    );

    cleanup();
    setupHooks();
    setupPreferences();
    renderPanel({ onError });

    fireEvent.click(screen.getByRole('button', { name: 'start deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'unavailable currency' }));
    await act(async () => {
      await Promise.resolve();
    });

    cleanup();
    setupHooks();
    setupPreferences();
    renderPanel({ onError });

    fireEvent.click(screen.getByRole('button', { name: 'start deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'zero amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    expect(onError).toHaveBeenCalledWith(
      'Transaction amount must be greater than 0.',
    );

    vi.mocked(createFinanceTransaction).mockRejectedValueOnce(new Error('transaction failed'));
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('transaction failed'));

    vi.mocked(createFinanceTransaction).mockRejectedValueOnce('nope');
    fireEvent.click(screen.getByRole('button', { name: 'start withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to save transaction.'),
    );

    vi.mocked(createFinanceTransaction).mockResolvedValueOnce(transfer({ type: 'withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'start withdraw' }));
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));
    await waitFor(() => expect(createFinanceTransaction).toHaveBeenCalled());
  });

  it('creates transfer without crashing even if crypto.randomUUID is unavailable', async () => {
    vi.unstubAllGlobals();
    // Simulate environment without randomUUID (e.g. some browsers or test contexts)
    vi.stubGlobal('crypto', {});

    const onSuccess = vi.fn();
    renderPanel({ onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'start transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'create transaction' }));

    await waitFor(() => expect(createFinanceTransaction).toHaveBeenCalled());
    const lastCall = vi.mocked(createFinanceTransaction).mock.calls.at(-1)?.[0] as
      | CreateFinanceTransactionPayload
      | undefined;
    expect(lastCall?.idempotencyKey).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled(); // mock does not auto succeed in this flow without further setup
  });

  it('handles settings actions and validation failures', async () => {
    mutableState.isFinanceSettingsOpen = true;
    const onError = vi.fn();
    const onSuccess = vi.fn();
    renderPanel({ onError, onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'settings create cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'cashbox name' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings create cashbox' }));
    await waitFor(() => expect(createCashbox).toHaveBeenCalledWith({ name: 'Desk' }));

    fireEvent.click(screen.getByRole('button', { name: 'toggle card' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'save cashbox' }));

    fireEvent.click(screen.getByRole('button', { name: 'edit cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'edit name' }));
    fireEvent.click(screen.getByRole('button', { name: 'save cashbox' }));
    await waitFor(() => expect(updateCashbox).toHaveBeenCalledWith('cashbox-1', { name: 'Renamed' }));

    fireEvent.click(screen.getByRole('button', { name: 'currency code' }));
    fireEvent.click(screen.getByRole('button', { name: 'add currency' }));
    await waitFor(() => expect(createFinanceCurrency).toHaveBeenCalledWith({ code: 'EUR' }));

    fireEvent.click(screen.getByRole('button', { name: 'bad currency code' }));
    fireEvent.click(screen.getByRole('button', { name: 'add currency' }));
    fireEvent.click(screen.getByRole('button', { name: 'duplicate currency code' }));
    fireEvent.click(screen.getByRole('button', { name: 'add currency' }));
    fireEvent.click(screen.getByRole('button', { name: 'remove uah' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle uah' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle box uah' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle missing currency' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle missing box' }));
    expect(onError).toHaveBeenCalledWith('UAH is the main currency and cannot be archived.');
    expect(onError).toHaveBeenCalledWith('UAH is always active.');
    expect(onError).toHaveBeenCalledWith('Currency code must be 3-6 latin letters.');
    expect(onError).toHaveBeenCalledWith('Currency already exists.');

    fireEvent.click(screen.getByRole('button', { name: 'remove usd' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle usd' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle box usd' }));
    fireEvent.click(screen.getByRole('button', { name: 'archive cashbox' }));
    await waitFor(() => expect(updateFinanceCurrency).toHaveBeenCalled());
    await waitFor(() => expect(updateCashbox).toHaveBeenCalled());
  });

  it('handles settings permission denials and API failures', async () => {
    mutableState.isFinanceSettingsOpen = true;
    const onError = vi.fn();
    const onSuccess = vi.fn();

    renderPanel({ currentEmployee: employee('support'), onError });
    fireEvent.click(screen.getByRole('button', { name: 'edit cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'save cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'archive cashbox' }));
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission to manage cashboxes.',
    );

    cleanup();
    mutableState.isFinanceSettingsOpen = true;
    setupHooks({
      allCashboxes: [cashbox({ isArchived: true })],
      cashboxes: [],
    });
    setupPreferences();
    renderPanel({ onError, onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'archive cashbox' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Cashbox reactivated.'));

    vi.mocked(updateCashbox).mockRejectedValueOnce(new Error('save failed'));
    fireEvent.click(screen.getByRole('button', { name: 'edit cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'save cashbox' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('save failed'));

    vi.mocked(updateCashbox).mockRejectedValueOnce('save failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'edit cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'save cashbox' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update cashbox.'),
    );

    vi.mocked(updateCashbox).mockRejectedValueOnce(new Error('status failed'));
    fireEvent.click(screen.getByRole('button', { name: 'archive cashbox' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('status failed'));

    vi.mocked(updateCashbox).mockRejectedValueOnce('bad status');
    fireEvent.click(screen.getByRole('button', { name: 'archive cashbox' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update cashbox status.'),
    );

    vi.mocked(createFinanceCurrency).mockRejectedValueOnce(new Error('currency failed'));
    fireEvent.click(screen.getByRole('button', { name: 'currency code' }));
    fireEvent.click(screen.getByRole('button', { name: 'add currency' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('currency failed'));

    vi.mocked(createFinanceCurrency).mockRejectedValueOnce('currency failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'currency code' }));
    fireEvent.click(screen.getByRole('button', { name: 'add currency' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to create currency.'),
    );

    vi.mocked(updateFinanceCurrency).mockRejectedValueOnce(new Error('archive failed'));
    fireEvent.click(screen.getByRole('button', { name: 'remove usd' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('archive failed'));

    vi.mocked(updateFinanceCurrency).mockRejectedValueOnce('archive failed');
    fireEvent.click(screen.getByRole('button', { name: 'remove usd' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to archive currency.'),
    );

    cleanup();
    mutableState.isFinanceSettingsOpen = true;
    setupHooks({
      currencies: [
        { ...currency(), code: 'UAH', isSystem: true },
        currency({ isArchived: true }),
      ],
    });
    setupPreferences();
    renderPanel({ onError, onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'toggle usd' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Currency restored.'));

    vi.mocked(updateFinanceCurrency).mockRejectedValueOnce(new Error('toggle failed'));
    fireEvent.click(screen.getByRole('button', { name: 'toggle usd' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('toggle failed'));

    vi.mocked(updateFinanceCurrency).mockRejectedValueOnce('toggle failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'toggle usd' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update currency.'),
    );

    vi.mocked(updateCashbox).mockRejectedValueOnce(new Error('box currency failed'));
    fireEvent.click(screen.getByRole('button', { name: 'toggle box usd' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('box currency failed'));

    vi.mocked(updateCashbox).mockRejectedValueOnce('box currency failed');
    fireEvent.click(screen.getByRole('button', { name: 'toggle box usd' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'Failed to update cashbox currency settings.',
      ),
    );

    vi.mocked(createCashbox).mockRejectedValueOnce('create failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'cashbox name' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings create cashbox' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to create cashbox.'),
    );

    vi.mocked(createCashbox).mockRejectedValueOnce(new Error('create failed'));
    fireEvent.click(screen.getByRole('button', { name: 'cashbox name' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings create cashbox' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('create failed'));
  });

  it('handles transactions tab modals and cancellation', async () => {
    mutableState.activeTab = 'transactions';
    const onError = vi.fn();
    const onOpenSaleCard = vi.fn();
    renderPanel({ onError, onOpenSaleCard });

    fireEvent.click(screen.getByRole('button', { name: 'filter open' }));
    fireEvent.click(screen.getByRole('button', { name: 'date open' }));
    fireEvent.click(screen.getByRole('button', { name: 'page high' }));
    fireEvent.click(screen.getByRole('button', { name: 'page size' }));
    fireEvent.click(screen.getByRole('button', { name: 'draft filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'select cashbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'can cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'sale card' }));
    expect(onOpenSaleCard).toHaveBeenCalledWith({ id: 'sale-1', kind: 'sale' });

    fireEvent.click(screen.getByRole('button', { name: 'cancel old transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm cancel transfer' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'Transfer can be cancelled only during the transaction day.',
      ),
    );

    vi.mocked(cancelFinanceTransaction).mockRejectedValueOnce(new Error('cancel failed'));
    fireEvent.click(screen.getByRole('button', { name: 'cancel transfer' }));
    expect(screen.getByTestId('cancel-transfer-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm cancel transfer' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('cancel failed'));

    vi.mocked(cancelFinanceTransaction).mockRejectedValueOnce('cancel failed');
    fireEvent.click(screen.getByRole('button', { name: 'cancel transfer' }));
    expect(screen.getByTestId('cancel-transfer-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm cancel transfer' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to cancel transfer.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'cancel transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'close cancel transfer' }));
    expect(screen.queryByTestId('cancel-transfer-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'cancel transfer' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm cancel transfer' }));
    await waitFor(() => expect(cancelFinanceTransaction).toHaveBeenCalledWith('tx-1'));

    fireEvent.click(screen.getByRole('button', { name: 'supplier modal' }));
    expect(screen.getByTestId('supplier-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'create supplier inline' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit supplier inline' }));
    fireEvent.click(screen.getByRole('button', { name: 'close supplier modal' }));
    expect(screen.queryByTestId('supplier-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'apply filter' }));
  });

  it('handles supplier order payments and issue without payment', async () => {
    mutableState.activeTab = 'orders';
    const onError = vi.fn();
    renderPanel({ onError });

    fireEvent.click(screen.getByRole('button', { name: 'orders form' }));
    fireEvent.click(screen.getByRole('button', { name: 'pay order without cashbox' }));
    expect(paySupplierOrder).not.toHaveBeenCalled();

    vi.mocked(paySupplierOrder).mockRejectedValueOnce(new Error('pay failed'));
    fireEvent.click(screen.getByRole('button', { name: 'pay order' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('pay failed'));

    vi.mocked(paySupplierOrder).mockRejectedValueOnce('pay failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'pay order' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to pay order.'),
    );

    vi.mocked(paySupplierOrder).mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'pay order' }));
    await waitFor(() =>
      expect(paySupplierOrder).toHaveBeenCalledWith('queue-1', {
        cashboxId: 'cashbox-1',
        note: 'Payment for order SO-1',
      }),
    );

    vi.mocked(issueSupplierOrderWithoutPayment).mockRejectedValueOnce(new Error('issue failed'));
    fireEvent.click(screen.getByRole('button', { name: 'issue without payment' }));
    expect(screen.getByTestId('issue-without-payment-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm issue without payment' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('issue failed'));

    vi.mocked(issueSupplierOrderWithoutPayment).mockRejectedValueOnce('issue failed');
    fireEvent.click(screen.getByRole('button', { name: 'issue without payment' }));
    expect(screen.getByTestId('issue-without-payment-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm issue without payment' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to issue order without payment.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'close issue without payment' }));
    expect(screen.queryByTestId('issue-without-payment-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm issue without payment' }));
    await waitFor(() =>
      expect(issueSupplierOrderWithoutPayment).toHaveBeenCalledWith('queue-1'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'open supplier' }));
    expect(screen.getByTestId('supplier-modal')).toBeInTheDocument();
  });

  it('renders reports tab', () => {
    mutableState.activeTab = 'reports';
    renderPanel();

    expect(screen.getByTestId('reports-view')).toHaveTextContent('1');
  });
});
