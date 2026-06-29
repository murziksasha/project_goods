import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentProps, ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as financeApi from '../../../../entities/finance/api/financeApi';
import i18n from '../../../../shared/i18n/config';
import * as useAccountingFinanceDataModule from './useAccountingFinanceData';
import * as useAccountingPreferencesModule from './useAccountingPreferences';

import type {
  Cashbox,
  CreateFinanceTransactionPayload,
  FinanceCurrencyConfig,
  FinanceReport,
  FinanceTransaction,
  FinanceTransactionType,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import type { Employee } from '../../../../entities/employee/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import type { Sale } from '../../../../entities/sale/model/types';
import type { AccountingPanel as AccountingPanelComponent } from './AccountingPanel';
import type { AccountingTransactionsView as RealAccountingTransactionsViewComponent } from './AccountingTransactionsView';

let AccountingPanel: typeof AccountingPanelComponent;
let RealAccountingTransactionsView: typeof RealAccountingTransactionsViewComponent;

const {
  cancelFinanceTransactionMock,
  createCashboxMock,
  createFinanceCurrencyMock,
  createFinanceTransactionMock,
  issueSupplierOrderWithoutPaymentMock,
  paySupplierOrderMock,
  updateCashboxMock,
  updateFinanceCurrencyMock,
  updateFinanceTransactionMock,
  useAccountingFinanceDataMock,
  useAccountingPreferencesMock,
} = vi.hoisted(() => ({
  cancelFinanceTransactionMock: vi.fn(),
  createCashboxMock: vi.fn(),
  createFinanceCurrencyMock: vi.fn(),
  createFinanceTransactionMock: vi.fn(),
  issueSupplierOrderWithoutPaymentMock: vi.fn(),
  paySupplierOrderMock: vi.fn(),
  updateCashboxMock: vi.fn(),
  updateFinanceCurrencyMock: vi.fn(),
  updateFinanceTransactionMock: vi.fn(),
  useAccountingFinanceDataMock: vi.fn(),
  useAccountingPreferencesMock: vi.fn(),
}));

vi.mock('../../../../entities/finance/api/financeApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../entities/finance/api/financeApi')
  >();
  return {
    ...actual,
    cancelFinanceTransaction: cancelFinanceTransactionMock,
    createCashbox: createCashboxMock,
    createFinanceCurrency: createFinanceCurrencyMock,
    createFinanceTransaction: createFinanceTransactionMock,
    issueSupplierOrderWithoutPayment: issueSupplierOrderWithoutPaymentMock,
    paySupplierOrder: paySupplierOrderMock,
    updateCashbox: updateCashboxMock,
    updateFinanceCurrency: updateFinanceCurrencyMock,
    updateFinanceTransaction: updateFinanceTransactionMock,
    useCancelFinanceTransactionMutation: () => ({
      mutateAsync: cancelFinanceTransactionMock,
    }),
    useCreateCashboxMutation: () => ({ mutateAsync: createCashboxMock }),
    useCreateFinanceCurrencyMutation: () => ({
      mutateAsync: createFinanceCurrencyMock,
    }),
    useCreateFinanceTransactionMutation: () => ({
      mutateAsync: createFinanceTransactionMock,
    }),
    useIssueSupplierOrderWithoutPaymentMutation: () => ({
      mutateAsync: issueSupplierOrderWithoutPaymentMock,
    }),
    usePaySupplierOrderMutation: () => ({
      mutateAsync: ({
        payload,
        supplierOrderId,
      }: {
        payload: { cashboxId: string; note?: string };
        supplierOrderId: string;
      }) => paySupplierOrderMock(supplierOrderId, payload),
    }),
    useUpdateCashboxMutation: () => ({
      mutateAsync: ({
        cashboxId,
        payload,
      }: {
        cashboxId: string;
        payload: Partial<Cashbox>;
      }) => updateCashboxMock(cashboxId, payload),
    }),
    useUpdateFinanceCurrencyMutation: () => ({
      mutateAsync: ({
        currencyCode,
        payload,
      }: {
        currencyCode: string;
        payload: { isArchived?: boolean };
      }) => updateFinanceCurrencyMock(currencyCode, payload),
    }),
    useUpdateFinanceTransactionMutation: () => ({
      mutateAsync: ({ transactionId, payload }: { transactionId: string; payload: any }) =>
        updateFinanceTransactionMock(transactionId, payload),
    }),
  };
});

vi.mock('./useAccountingFinanceData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useAccountingFinanceData')>();
  return { ...actual, useAccountingFinanceData: useAccountingFinanceDataMock };
});

vi.mock('./useAccountingPreferences', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useAccountingPreferences')>();
  return { ...actual, useAccountingPreferences: useAccountingPreferencesMock };
});

const now = '2026-06-16T10:00:00.000Z';

const employee = (role: Employee['role'] = 'owner', permissions: Employee['permissions'] = []): Employee => ({
  id: 'employee-1',
  name: 'Owner',
  phone: '',
  email: '',
  username: 'owner',
  role,
  permissions,
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
  expandedFinanceSettingsCard: null as string | null,
  financeSettingsTab: 'cashboxes' as 'cashboxes' | 'currencies',
};

let panelRerender: (() => void) | null = null;

const setupHooks = (
  patch: Partial<ReturnType<typeof useAccountingFinanceDataMock>> = {},
) => {
  const cashboxes = [
    cashbox(),
    cashbox({ id: 'cashbox-2', name: 'Reserve', balances: { UAH: 0, USD: 0 } }),
  ];
  useAccountingFinanceDataMock.mockReturnValue({
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
  patch: Partial<ReturnType<typeof useAccountingPreferencesMock>> = {},
) => {
  useAccountingPreferencesMock.mockImplementation(() => ({
    activeTab: mutableState.activeTab,
    expandedFinanceSettingsCard: mutableState.expandedFinanceSettingsCard,
    financeSettingsTab: mutableState.financeSettingsTab,
    isFinanceSettingsOpen: mutableState.isFinanceSettingsOpen,
    lastTargetCashboxByType: {},
    setActiveTab: vi.fn((next) => {
      mutableState.activeTab = next;
      panelRerender?.();
    }),
    setExpandedFinanceSettingsCard: vi.fn((updater) => {
      if (typeof updater === 'function') {
        mutableState.expandedFinanceSettingsCard = updater(
          mutableState.expandedFinanceSettingsCard,
        );
      } else {
        mutableState.expandedFinanceSettingsCard = updater;
      }
      panelRerender?.();
    }),
    setFinanceSettingsTab: vi.fn((tab) => {
      mutableState.financeSettingsTab = tab;
      panelRerender?.();
    }),
    setIsFinanceSettingsOpen: vi.fn((updater) => {
      if (typeof updater === 'function') {
        mutableState.isFinanceSettingsOpen = updater(mutableState.isFinanceSettingsOpen);
      } else {
        mutableState.isFinanceSettingsOpen = updater;
      }
      panelRerender?.();
    }),
    setLastTargetCashboxByType: vi.fn((updater) => {
      if (typeof updater === 'function') {
        updater({});
      }
    }),
    ...patch,
  }));
};

const restoreApiMocks = () => {
  vi.spyOn(financeApi, 'cancelFinanceTransaction').mockImplementation((transactionId) =>
    cancelFinanceTransactionMock(transactionId),
  );
  vi.spyOn(financeApi, 'createCashbox').mockImplementation((payload) =>
    createCashboxMock(payload),
  );
  vi.spyOn(financeApi, 'createFinanceCurrency').mockImplementation((payload) =>
    createFinanceCurrencyMock(payload),
  );
  vi.spyOn(financeApi, 'createFinanceTransaction').mockImplementation((payload) =>
    createFinanceTransactionMock(payload),
  );
  vi.spyOn(financeApi, 'issueSupplierOrderWithoutPayment').mockImplementation((supplierOrderId) =>
    issueSupplierOrderWithoutPaymentMock(supplierOrderId),
  );
  vi.spyOn(financeApi, 'paySupplierOrder').mockImplementation((supplierOrderId, payload) =>
    paySupplierOrderMock(supplierOrderId, payload),
  );
  vi.spyOn(financeApi, 'updateCashbox').mockImplementation((cashboxId, payload) =>
    updateCashboxMock(cashboxId, payload),
  );
  vi.spyOn(financeApi, 'updateFinanceCurrency').mockImplementation((currencyCode, payload) =>
    updateFinanceCurrencyMock(currencyCode, payload),
  );
  vi.spyOn(financeApi, 'updateFinanceTransaction').mockImplementation((transactionId, payload) =>
    updateFinanceTransactionMock(transactionId, payload),
  );
  vi.spyOn(financeApi, 'useCreateCashboxMutation').mockReturnValue({
    mutateAsync: createCashboxMock,
  } as unknown as ReturnType<typeof financeApi.useCreateCashboxMutation>);
  vi.spyOn(financeApi, 'useUpdateCashboxMutation').mockReturnValue({
    mutateAsync: ({ cashboxId, payload }: { cashboxId: string; payload: Partial<Cashbox> }) =>
      updateCashboxMock(cashboxId, payload),
  } as unknown as ReturnType<typeof financeApi.useUpdateCashboxMutation>);
  vi.spyOn(financeApi, 'useCreateFinanceCurrencyMutation').mockReturnValue({
    mutateAsync: createFinanceCurrencyMock,
  } as unknown as ReturnType<typeof financeApi.useCreateFinanceCurrencyMutation>);
  vi.spyOn(financeApi, 'useUpdateFinanceCurrencyMutation').mockReturnValue({
    mutateAsync: ({
      currencyCode,
      payload,
    }: {
      currencyCode: string;
      payload: { isArchived?: boolean };
    }) => updateFinanceCurrencyMock(currencyCode, payload),
  } as unknown as ReturnType<typeof financeApi.useUpdateFinanceCurrencyMutation>);
  vi.spyOn(financeApi, 'useCreateFinanceTransactionMutation').mockReturnValue({
    mutateAsync: createFinanceTransactionMock,
  } as unknown as ReturnType<typeof financeApi.useCreateFinanceTransactionMutation>);
  vi.spyOn(financeApi, 'useCancelFinanceTransactionMutation').mockReturnValue({
    mutateAsync: cancelFinanceTransactionMock,
  } as unknown as ReturnType<typeof financeApi.useCancelFinanceTransactionMutation>);
  vi.spyOn(financeApi, 'usePaySupplierOrderMutation').mockReturnValue({
    mutateAsync: ({
      payload,
      supplierOrderId,
    }: {
      payload: { cashboxId: string; note?: string };
      supplierOrderId: string;
    }) => paySupplierOrderMock(supplierOrderId, payload),
  } as unknown as ReturnType<typeof financeApi.usePaySupplierOrderMutation>);
  vi.spyOn(financeApi, 'useIssueSupplierOrderWithoutPaymentMutation').mockReturnValue({
    mutateAsync: issueSupplierOrderWithoutPaymentMock,
  } as unknown as ReturnType<typeof financeApi.useIssueSupplierOrderWithoutPaymentMutation>);
  vi.spyOn(financeApi, 'useUpdateFinanceTransactionMutation').mockReturnValue({
    mutateAsync: ({ transactionId, payload }: { transactionId: string; payload: unknown }) =>
      updateFinanceTransactionMock(transactionId, payload),
  } as unknown as ReturnType<typeof financeApi.useUpdateFinanceTransactionMutation>);
  vi.spyOn(useAccountingFinanceDataModule, 'useAccountingFinanceData').mockImplementation(
    useAccountingFinanceDataMock,
  );
  vi.spyOn(useAccountingPreferencesModule, 'useAccountingPreferences').mockImplementation(
    useAccountingPreferencesMock,
  );
};

const renderWithProviders = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  );
};

const renderPanel = (props: Partial<ComponentProps<typeof AccountingPanel>> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const panelProps: ComponentProps<typeof AccountingPanel> = {
    currentEmployee: employee(),
    onError: vi.fn(),
    onSuccess: vi.fn(),
    sales: [],
    onOpenSaleCard: vi.fn(),
    ...props,
  };
  const ui = (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <AccountingPanel {...panelProps} />
      </I18nextProvider>
    </QueryClientProvider>
  );
  const result = render(ui);
  panelRerender = () => {
    result.rerender(
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <AccountingPanel {...panelProps} />
        </I18nextProvider>
      </QueryClientProvider>,
    );
  };
  return result;
};

const accountingTablist = () => screen.getByRole('tablist', { name: 'Accounting sections' });

const clickTab = (tab: 'Cashboxes' | 'Transactions' | 'Orders' | 'Information') => {
  fireEvent.click(within(accountingTablist()).getByRole('button', { name: tab }));
};

const openAccountingSettings = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Accounting settings' }));
};

const clickFirstCashboxAction = (action: 'Withdraw' | 'Deposit' | 'Transfer') => {
  fireEvent.click(screen.getAllByRole('button', { name: action })[0]);
};

const setNewCashboxName = async (name: string) => {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText('New cashbox'), { target: { value: name } });
  });
};

const createCashbox = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Add cashbox' }));
  });
};

const setTransactionAmount = async (amount: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Amount', { selector: 'input' }), {
      target: { value: amount },
    });
  });
};

const setTransactionType = async (type: FinanceTransactionType) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Type', { selector: 'select' }), {
      target: { value: type },
    });
  });
};

const saveTransaction = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save operation' }));
  });
};

const waitForCashboxesView = async () => {
  await waitFor(() => {
    expect(screen.getByPlaceholderText('New cashbox')).toBeInTheDocument();
  });
};

const expandSettingsCard = async (title: string | RegExp) => {
  const pattern = typeof title === 'string' ? new RegExp(title, 'i') : title;
  const toggle = screen.getByRole('button', { name: pattern });
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    await act(async () => {
      fireEvent.click(toggle);
    });
  }
};

const setSettingsCashboxName = async (name: string) => {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText('Enter cashbox name'), {
      target: { value: name },
    });
  });
};

const createCashboxInSettings = async () => {
  await act(async () => {
    const createButtons = screen.getAllByRole('button', { name: 'Create' });
    fireEvent.click(createButtons[createButtons.length - 1]!);
  });
};

const clickSettingsTab = (tab: 'Cashboxes' | 'Currencies') => {
  const target = Array.from(document.querySelectorAll('.warehouse-settings-tab')).find(
    (element) => element.textContent === tab,
  );
  if (target) {
    fireEvent.click(target);
  }
};

const resetMutableState = () => {
  mutableState.activeTab = 'cashboxes';
  mutableState.isFinanceSettingsOpen = false;
  mutableState.expandedFinanceSettingsCard = null;
  mutableState.financeSettingsTab = 'cashboxes';
};

const preparePanelTest = async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetMutableState();
  panelRerender = null;
  cancelFinanceTransactionMock.mockReset();
  createCashboxMock.mockReset();
  createFinanceCurrencyMock.mockReset();
  createFinanceTransactionMock.mockReset();
  issueSupplierOrderWithoutPaymentMock.mockReset();
  paySupplierOrderMock.mockReset();
  updateCashboxMock.mockReset();
  updateFinanceCurrencyMock.mockReset();
  updateFinanceTransactionMock.mockReset();
  useAccountingFinanceDataMock.mockReset();
  useAccountingPreferencesMock.mockReset();
  setupHooks();
  setupPreferences();
  restoreApiMocks();
  createCashboxMock.mockResolvedValue(cashbox());
  createFinanceTransactionMock.mockResolvedValue(transfer());
  createFinanceCurrencyMock.mockResolvedValue(currency());
  updateCashboxMock.mockResolvedValue(cashbox());
  updateFinanceCurrencyMock.mockResolvedValue(currency());
  cancelFinanceTransactionMock.mockResolvedValue(transfer());
  paySupplierOrderMock.mockResolvedValue(undefined);
  issueSupplierOrderWithoutPaymentMock.mockResolvedValue(undefined);
  vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' });
  ({ AccountingPanel } = await import('./AccountingPanel'));
};

describe('AccountingPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await preparePanelTest();
  });

  it('renders loading state', () => {
    setupHooks({ isLoading: true });

    renderPanel();

    expect(screen.getByText('Loading finance data...')).toBeInTheDocument();
  });

  it('drives cashbox operations from the cashboxes view', async () => {
    const onSuccess = vi.fn();
    renderPanel({ onSuccess });
    await waitForCashboxesView();

    openAccountingSettings();
    clickTab('Transactions');
    clickTab('Orders');
    clickTab('Information');
    clickTab('Cashboxes');

    await setNewCashboxName('Desk');
    await createCashbox();
    await waitFor(() => expect(createCashboxMock).toHaveBeenCalledWith({ name: 'Desk' }));

    const cards = document.querySelectorAll('.finance-cashbox-card');
    fireEvent.dragStart(cards[0]);
    fireEvent.dragOver(cards[1]);
    fireEvent.drop(cards[1]);

    clickFirstCashboxAction('Withdraw');
    clickFirstCashboxAction('Transfer');
    await setTransactionType('withdraw');
    await setTransactionType('deposit');
    clickFirstCashboxAction('Deposit');
    await setTransactionAmount('25');
    await saveTransaction();

    await waitFor(() => expect(createFinanceTransactionMock).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalledWith('Finance transaction saved.');

    await setTransactionType('transfer');
    fireEvent.click(screen.getAllByRole('button', { name: 'Transactions' })[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    });
  });

  it('resolves remembered and fallback cashbox targets', async () => {
    setupPreferences({ lastTargetCashboxByType: { deposit: 'cashbox-2', transfer: 'cashbox-2' } });
    renderPanel();
    await waitForCashboxesView();

    clickFirstCashboxAction('Deposit');
    await setTransactionType('transfer');
    await setTransactionType('withdraw');

    cleanup();
    await preparePanelTest();
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
    await waitForCashboxesView();

    cleanup();
    await preparePanelTest();
    setupHooks({
      allCashboxes: [cashbox()],
      cashboxes: [cashbox()],
    });
    setupPreferences({ lastTargetCashboxByType: { transfer: 'cashbox-1' } });
    renderPanel();
    await waitForCashboxesView();

    clickFirstCashboxAction('Transfer');

    cleanup();
    await preparePanelTest();
    setupHooks({ allCashboxes: [], cashboxes: [] });
    setupPreferences();
    renderPanel();

    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument();
  });

  it('reports cashbox and transaction validation failures', async () => {
    const onError = vi.fn();
    renderPanel({ currentEmployee: employee('support'), onError });

    expect(screen.queryByRole('button', { name: 'Deposit' })).not.toBeInTheDocument();

    cleanup();
    await preparePanelTest();
    mutableState.isFinanceSettingsOpen = true;
    renderPanel({ currentEmployee: employee('support'), onError });
    await expandSettingsCard('Create cashbox');
    await setSettingsCashboxName('Desk');
    await createCashboxInSettings();
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission to manage cashboxes.',
    );

    cleanup();
    await preparePanelTest();
    setupHooks();
    setupPreferences();
    renderPanel({ onError });
    await waitForCashboxesView();

    clickFirstCashboxAction('Deposit');
    await setTransactionAmount('0');
    await saveTransaction();
    expect(onError).toHaveBeenCalledWith(
      'Transaction amount must be greater than 0.',
    );

    createFinanceTransactionMock.mockRejectedValueOnce(new Error('transaction failed'));
    await setTransactionAmount('25');
    await saveTransaction();
    await waitFor(() => expect(onError).toHaveBeenCalledWith('transaction failed'));

    createFinanceTransactionMock.mockRejectedValueOnce('nope');
    clickFirstCashboxAction('Withdraw');
    await setTransactionAmount('25');
    await saveTransaction();
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to save transaction.'),
    );

    createFinanceTransactionMock.mockResolvedValueOnce(transfer({ type: 'withdraw' }));
    clickFirstCashboxAction('Withdraw');
    await setTransactionAmount('25');
    await saveTransaction();
    await waitFor(() => expect(createFinanceTransactionMock).toHaveBeenCalled());
  });

  it('creates transfer without crashing even if crypto.randomUUID is unavailable', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('crypto', {});

    const onSuccess = vi.fn();
    renderPanel({ onSuccess });
    await waitForCashboxesView();

    clickFirstCashboxAction('Transfer');
    await setTransactionAmount('25');
    await saveTransaction();

    await waitFor(() => expect(createFinanceTransactionMock).toHaveBeenCalled());
    const lastCall = createFinanceTransactionMock.mock.calls.at(-1)?.[0] as
      | CreateFinanceTransactionPayload
      | undefined;
    expect(lastCall?.idempotencyKey).toBeTruthy();
    expect(onSuccess).toHaveBeenCalledWith('Finance transaction saved.');
  });

  it('handles settings actions and validation failures', async () => {
    mutableState.isFinanceSettingsOpen = true;
    const onError = vi.fn();
    const onSuccess = vi.fn();
    renderPanel({ onError, onSuccess });

    await expandSettingsCard('Create cashbox');
    await setSettingsCashboxName('Desk');
    await createCashboxInSettings();
    await waitFor(() => expect(createCashboxMock).toHaveBeenCalledWith({ name: 'Desk' }));

    await expandSettingsCard(/Edit cashbox Main/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit cashbox' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('Main'), { target: { value: 'Renamed' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() =>
      expect(updateCashboxMock).toHaveBeenCalledWith('cashbox-1', { name: 'Renamed' }),
    );

    clickSettingsTab('Currencies');
    await expandSettingsCard('Create currency');
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('EUR'), { target: { value: 'eur' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    });
    await waitFor(() => expect(createFinanceCurrencyMock).toHaveBeenCalledWith({ code: 'EUR' }));

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('EUR'), { target: { value: '12X' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Currency code must be 3-6 latin letters.'),
    );

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('EUR'), { target: { value: 'usd' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Currency already exists.'),
    );

    await expandSettingsCard('Currency activity');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    });
    const usdToggle = screen
      .getAllByRole('checkbox')
      .find((input) => input.closest('.finance-currency-activity-item')?.textContent?.includes('USD'));
    if (usdToggle) {
      await act(async () => {
        fireEvent.click(usdToggle);
      });
    }

    clickSettingsTab('Cashboxes');
    await expandSettingsCard(/Edit cashbox Main/i);
    const mainActiveToggle = screen
      .getAllByRole('checkbox')
      .find((input) =>
        input.closest('.catalog-edit-body')?.textContent?.includes('Active (default)'),
      );
    if (mainActiveToggle) {
      fireEvent.click(mainActiveToggle);
    }

    await waitFor(() => expect(updateFinanceCurrencyMock).toHaveBeenCalled());
    await waitFor(() => expect(updateCashboxMock).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('handles settings permission denials and API failures', async () => {
    mutableState.isFinanceSettingsOpen = true;
    const onError = vi.fn();
    const onSuccess = vi.fn();

    renderPanel({ currentEmployee: employee('support'), onError });
    await expandSettingsCard(/Edit cashbox Main/i);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit cashbox' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    const mainActiveToggle = screen
      .getAllByRole('checkbox')
      .find((input) =>
        input.closest('.catalog-edit-body')?.textContent?.includes('Active (default)'),
      );
    if (mainActiveToggle) {
      fireEvent.click(mainActiveToggle);
    }
    expect(onError).toHaveBeenCalledWith(
      'Current employee does not have permission to manage cashboxes.',
    );

    cleanup();
    await preparePanelTest();
    mutableState.isFinanceSettingsOpen = true;
    setupHooks({
      allCashboxes: [cashbox({ isArchived: true })],
      cashboxes: [],
    });
    setupPreferences();
    renderPanel({ onError, onSuccess });

    await expandSettingsCard(/Edit cashbox Main/i);
    const archivedActiveToggle = screen
      .getAllByRole('checkbox')
      .find((input) => input.closest('.catalog-edit-body')?.textContent?.includes('Active'));
    if (archivedActiveToggle) {
      fireEvent.click(archivedActiveToggle);
    }
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Cashbox reactivated.'));

    updateCashboxMock.mockRejectedValueOnce(new Error('save failed'));
    await expandSettingsCard(/Edit cashbox Main/i);
    const editCashboxButton = screen.queryByRole('button', { name: 'Edit cashbox' });
    if (editCashboxButton) {
      await act(async () => {
        fireEvent.click(editCashboxButton);
      });
    }
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() => expect(onError).toHaveBeenCalledWith('save failed'));

    updateCashboxMock.mockRejectedValueOnce('save failed generic');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update cashbox.'),
    );

    updateCashboxMock.mockRejectedValueOnce(new Error('status failed'));
    if (archivedActiveToggle) {
      fireEvent.click(archivedActiveToggle);
    }
    await waitFor(() => expect(onError).toHaveBeenCalledWith('status failed'));

    updateCashboxMock.mockRejectedValueOnce('bad status');
    if (archivedActiveToggle) {
      fireEvent.click(archivedActiveToggle);
    }
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update cashbox status.'),
    );

    clickSettingsTab('Currencies');
    await expandSettingsCard('Create currency');
    createFinanceCurrencyMock.mockRejectedValueOnce(new Error('currency failed'));
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('EUR'), { target: { value: 'eur' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    });
    await waitFor(() => expect(onError).toHaveBeenCalledWith('currency failed'));

    createFinanceCurrencyMock.mockRejectedValueOnce('currency failed generic');
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('EUR'), { target: { value: 'eur' } });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add currency' }));
    });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to create currency.'),
    );

    await expandSettingsCard('Currency activity');
    updateFinanceCurrencyMock.mockRejectedValueOnce(new Error('archive failed'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    });
    await waitFor(() => expect(onError).toHaveBeenCalledWith('archive failed'));

    updateFinanceCurrencyMock.mockRejectedValueOnce('archive failed');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to archive currency.'),
    );

    cleanup();
    await preparePanelTest();
    mutableState.isFinanceSettingsOpen = true;
    setupHooks({
      currencies: [
        { ...currency(), code: 'UAH', isSystem: true },
        currency({ isArchived: true }),
      ],
    });
    setupPreferences();
    renderPanel({ onError, onSuccess });

    clickSettingsTab('Currencies');
    await expandSettingsCard('Currency activity');
    const usdToggle = screen
      .getAllByRole('checkbox')
      .find((input) => input.closest('.finance-currency-activity-item')?.textContent?.includes('USD'));
    if (usdToggle) {
      await act(async () => {
        fireEvent.click(usdToggle);
      });
    }
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Currency restored.'));

    updateFinanceCurrencyMock.mockRejectedValueOnce(new Error('toggle failed'));
    if (usdToggle) {
      await act(async () => {
        fireEvent.click(usdToggle);
      });
    }
    await waitFor(() => expect(onError).toHaveBeenCalledWith('toggle failed'));

    updateFinanceCurrencyMock.mockRejectedValueOnce('toggle failed generic');
    if (usdToggle) {
      await act(async () => {
        fireEvent.click(usdToggle);
      });
    }
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to update currency.'),
    );

    clickSettingsTab('Cashboxes');
    await expandSettingsCard(/Edit cashbox Main/i);
    const boxUsdToggle = screen
      .getAllByRole('checkbox')
      .find(
        (input) =>
          input.closest('.finance-currency-activity-item')?.textContent?.includes('USD') &&
          input.closest('.finance-settings-cashbox'),
      );
    updateCashboxMock.mockRejectedValueOnce(new Error('box currency failed'));
    if (boxUsdToggle) {
      fireEvent.click(boxUsdToggle);
    }
    await waitFor(() => expect(onError).toHaveBeenCalledWith('box currency failed'));

    updateCashboxMock.mockRejectedValueOnce('box currency failed');
    if (boxUsdToggle) {
      fireEvent.click(boxUsdToggle);
    }
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        'Failed to update cashbox currency settings.',
      ),
    );

    await expandSettingsCard('Create cashbox');
    createCashboxMock.mockRejectedValueOnce('create failed generic');
    await setSettingsCashboxName('Desk');
    await createCashboxInSettings();
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to create cashbox.'),
    );

    createCashboxMock.mockRejectedValueOnce(new Error('create failed'));
    await setSettingsCashboxName('Desk');
    await createCashboxInSettings();
    await waitFor(() => expect(onError).toHaveBeenCalledWith('create failed'));
  });

  it('handles transactions tab modals and cancellation', async () => {
    vi.setSystemTime(new Date('2026-06-16T10:00:00.000Z'));
    mutableState.activeTab = 'transactions';
    const onError = vi.fn();
    const openSpy = vi.fn();
    const origOpen = window.open;
    window.open = openSpy;

    const sampleSale: Sale = {
      id: 'sale-1',
      kind: 'sale',
      recordNumber: 's001',
      status: 'inRepair',
      deviceName: '',
      deviceBrand: '',
      deviceModel: '',
      serialNumber: '',
      note: '',
      client: { id: 'c1', name: 'Client', phone: '', status: 'active' },
      discount: { mode: 'amount', value: 0 },
      paidAmount: 0,
      lineItems: [],
      createdAt: '2026',
      updatedAt: '2026',
    } as unknown as Sale;

    setupHooks({
      transactions: [
        transfer({ id: 'tx-1', transactionDate: now }),
        transfer({
          id: 'tx-old',
          transactionDate: '2020-01-01T00:00:00.000Z',
        }),
        transfer({
          id: 'tx-sale',
          type: 'deposit',
          fromCashbox: null,
          toCashbox: { id: 'cashbox-1', name: 'Main' },
          note: 'Payment for order s001',
          transactionDate: now,
        }),
        transfer({
          id: 'tx-supplier',
          type: 'deposit',
          fromCashbox: null,
          toCashbox: { id: 'cashbox-1', name: 'Main' },
          note: 'Payment for order SO-1',
          transactionDate: now,
        }),
      ],
    });

    renderPanel({
      onError,
      sales: [sampleSale],
      currentEmployee: employee('owner', ['finance.transactions.transfer']),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Date' }));
    fireEvent.click(screen.getByLabelText('Filter transactions by cashbox'));
    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Payment for order s001' }));
    expect(openSpy).toHaveBeenCalled();

    expect(screen.queryByText('01.01.2020')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: 'Cancel transfer' })).toHaveLength(1);

    cancelFinanceTransactionMock.mockRejectedValueOnce(new Error('cancel failed'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel transfer' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('cancel failed'));

    cancelFinanceTransactionMock.mockRejectedValueOnce('cancel failed');
    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel transfer' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to cancel transfer.'),
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel transfer' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Cancel transfer' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel transfer' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    await waitFor(() => expect(cancelFinanceTransactionMock).toHaveBeenCalledWith('tx-1'));

    fireEvent.click(screen.getByRole('button', { name: 'Payment for order SO-1' }));
    const supplierDialog = screen.getByRole('dialog');
    expect(supplierDialog).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        within(within(supplierDialog).getByRole('contentinfo')).getByRole('button', {
          name: 'Close',
        }),
      );
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    window.open = origOpen;
  });

  it('handles supplier order payments and issue without payment', async () => {
    mutableState.activeTab = 'orders';
    const onError = vi.fn();
    renderPanel({ onError });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Cashbox', { selector: 'select' }), {
        target: { value: 'cashbox-2' },
      });
    });

    cleanup();
    await preparePanelTest();
    mutableState.activeTab = 'orders';
    setupHooks({ allCashboxes: [], cashboxes: [], supplierOrdersQueue: [queueItem()] });
    setupPreferences();
    renderPanel({ onError });

    expect(screen.getByRole('button', { name: 'Pay' })).toBeDisabled();
    expect(paySupplierOrderMock).not.toHaveBeenCalled();

    cleanup();
    await preparePanelTest();
    mutableState.activeTab = 'orders';
    setupHooks();
    setupPreferences();
    renderPanel({ onError });

    paySupplierOrderMock.mockRejectedValueOnce(new Error('pay failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('pay failed'));

    paySupplierOrderMock.mockRejectedValueOnce('pay failed generic');
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to pay order.'),
    );

    paySupplierOrderMock.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    await waitFor(() =>
      expect(paySupplierOrderMock).toHaveBeenCalledWith('queue-1', {
        cashboxId: 'cashbox-1',
        note: 'Payment for order SO-1',
      }),
    );

    issueSupplierOrderWithoutPaymentMock.mockRejectedValueOnce(new Error('issue failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('issue failed'));

    issueSupplierOrderWithoutPaymentMock.mockRejectedValueOnce('issue failed');
    fireEvent.click(screen.getByRole('button', { name: 'Issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith('Failed to issue order without payment.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'Confirm issue without payment' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Issue without payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(issueSupplierOrderWithoutPaymentMock).toHaveBeenCalledWith('queue-1'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open supplier order SO-1' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders reports tab', () => {
    mutableState.activeTab = 'reports';
    renderPanel();

    expect(screen.getByText('Accounting information')).toBeInTheDocument();
    const summaryCards = document.querySelectorAll('.finance-report-grid .analytics-summary-card');
    expect(summaryCards[0]?.textContent).toContain('1');
  });
});

describe('AccountingTransactionsView note navigation (real component)', () => {
  beforeAll(async () => {
    ({ AccountingTransactionsView: RealAccountingTransactionsView } =
      await vi.importActual<typeof import('./AccountingTransactionsView')>(
        './AccountingTransactionsView',
      ));
  });

  afterEach(() => {
    cleanup();
  });

  const baseCashbox = { id: 'cb1', name: 'Main' } as any;
  const baseTx = (note: string) => ({
    id: 'tx-note',
    type: 'deposit' as const,
    amount: 10,
    currency: 'UAH',
    fromCashbox: null,
    toCashbox: baseCashbox,
    note,
    transactionDate: '2026-06-18T10:00:00.000Z',
    status: 'active' as const,
    isCancellation: false,
    createdAt: '2026-06-18',
    updatedAt: '2026-06-18',
  });

  const sampleSale: Sale = {
    id: 'sale-xyz',
    kind: 'repair',
    recordNumber: 'r000066',
    status: 'inRepair',
    deviceName: '',
    deviceBrand: '',
    deviceModel: '',
    serialNumber: '',
    note: '',
    client: { id: 'c1', name: 'Client', phone: '', status: 'active' },
    discount: { mode: 'amount', value: 0 },
    paidAmount: 0,
    lineItems: [],
    createdAt: '2026',
    updatedAt: '2026',
  } as any as Sale;
  const sampleSaleSaleKind: Sale = { ...sampleSale, id: 'sale-sale', kind: 'sale', recordNumber: 's999' };

  const sampleSupplier = {
    id: 'sup-1',
    number: 'SUP-77',
    orderBaseId: 'base-77',
    supplierId: 's1',
    supplierName: 'Supp',
    deliveryDate: '2026-07-01',
    items: [],
    total: 0,
    paymentStatus: 'pending',
    status: 'approved',
    receiptStatus: 'pending',
    createdAt: '2026',
    updatedAt: '2026',
  } as any as import('../../../../entities/supplier-order/model/types').SupplierOrder;

  const minimalProps = (txNote: string, salesList: Sale[] = [], suppliersList: any[] = []) => ({
    activeFiltersCount: 0,
    allCurrencyCodes: ['UAH'],
    appliedFilters: { note: '', type: null, sortBy: 'date', sortDirection: 'desc' } as any,
    balanceAfterByTransactionId: {},
    cashboxes: [],
    draftFilters: { note: '', type: null, sortBy: 'date', sortDirection: 'desc' } as any,
    filteredTransactions: [baseTx(txNote) as any],
    isDateFilterOpen: false,
    isFilterOpen: false,
    page: 1,
    pageSize: 10,
    paginatedTransactions: [baseTx(txNote) as any],
    sales: salesList,
    selectedCashboxId: 'cb1',
    supplierOrders: suppliersList,
    canCancelTransferTransaction: () => false,
    onDateFilterOpenChange: vi.fn(),
    onFilterOpenChange: vi.fn(),
    onOpenSaleCard: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSelectedCashboxIdChange: vi.fn(),
    onSelectedSupplierOrderChange: vi.fn(),
    onSetAppliedFilters: vi.fn(),
    onSetDraftFilters: vi.fn(),
    onSetTransferToCancel: vi.fn(),
    onEditTransactionNote: vi.fn(),
  });

  it('Payment for order r000066 opens a new browser tab for sale/repair order', async () => {
    const openSpy = vi.fn();
    const origOpen = window.open;
    window.open = openSpy;

    const props = minimalProps('Payment for order r000066', [sampleSale], []);
    renderWithProviders(<RealAccountingTransactionsView {...props} />);

    const noteBtn = screen.getByRole('button', { name: 'Payment for order r000066' });
    fireEvent.click(noteBtn);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const urlArg = openSpy.mock.calls[0][0] as string;
    expect(urlArg).toContain('page=orders');
    expect(urlArg).toContain('saleId=sale-xyz');
    expect(urlArg).toContain('ordersTab=orders');

    window.open = origOpen;
  });

  it('Refund for order follows same resolution rules and opens tab', async () => {
    const openSpy = vi.fn();
    const origOpen = window.open;
    window.open = openSpy;

    const saleForRefund = { ...sampleSaleSaleKind, recordNumber: 's999' };
    const props = minimalProps('Refund for order s999', [saleForRefund], []);
    renderWithProviders(<RealAccountingTransactionsView {...props} />);

    const noteBtn = screen.getByRole('button', { name: 'Refund for order s999' });
    fireEvent.click(noteBtn);

    expect(openSpy).toHaveBeenCalled();
    expect(openSpy.mock.calls[0][0]).toContain('ordersTab=sales');
    expect(openSpy.mock.calls[0][0]).toContain('saleId=sale-sale');

    window.open = origOpen;
  });

  it('Supplier-order note still opens read-only supplier modal via onSelectedSupplierOrderChange', async () => {
    const onSelect = vi.fn();
    const props = {
      ...minimalProps('Payment for order SUP-77', [], [sampleSupplier]),
      onSelectedSupplierOrderChange: onSelect,
    };
    renderWithProviders(<RealAccountingTransactionsView {...props} />);

    const noteBtn = screen.getByRole('button', { name: /Payment for order SUP-77/i });
    fireEvent.click(noteBtn);

    expect(onSelect).toHaveBeenCalledWith(sampleSupplier);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('Plain manual deposit/withdraw note does not open an order (renders as editable note button)', async () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    const props = {
      ...minimalProps('Manual cash deposit from client', [], []),
      onSelectedSupplierOrderChange: onSelect,
      onOpenSaleCard: vi.fn(),
      onEditTransactionNote: onEdit,
    };
    const { container } = renderWithProviders(<RealAccountingTransactionsView {...props} />);

    const noteBtn = screen.getByRole('button', { name: 'Manual cash deposit from client' });
    expect(noteBtn).toBeInTheDocument();
    expect(container.textContent).toContain('Manual cash deposit from client');
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.click(noteBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows Cancel transfer only when canCancelTransferTransaction returns true', async () => {
    const txToday = baseTx('') as any;
    txToday.id = 'tx-today';
    txToday.type = 'transfer';
    txToday.fromCashbox = { id: 'c1', name: 'A' };
    txToday.toCashbox = { id: 'c2', name: 'B' };
    txToday.transactionDate = '2026-06-18T10:00:00.000Z';

    const txOld = { ...txToday, id: 'tx-old', transactionDate: '2026-06-01T10:00:00.000Z' };

    const propsToday = {
      ...minimalProps('', [], []),
      paginatedTransactions: [txToday],
      filteredTransactions: [txToday],
      canCancelTransferTransaction: (t: any) => t.id === 'tx-today',
      onSetTransferToCancel: vi.fn(),
    };
    const { container: c1, unmount } = renderWithProviders(
      <RealAccountingTransactionsView {...propsToday} />,
    );
    expect(c1.textContent).toContain('Cancel transfer');
    unmount();

    const propsOld = {
      ...propsToday,
      paginatedTransactions: [txOld],
      filteredTransactions: [txOld],
      canCancelTransferTransaction: (t: any) => t.id === 'tx-today',
    };
    const { container: c2 } = renderWithProviders(
      <RealAccountingTransactionsView {...propsOld} />,
    );
    expect(c2.textContent).not.toContain('Cancel transfer');
  });
});

describe('AccountingPanel transaction note editing', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    await preparePanelTest();
    updateFinanceTransactionMock.mockResolvedValue({} as any);
  });

  it('clicking manual withdraw/deposit note opens note modal', async () => {
    mutableState.activeTab = 'transactions';
    setupHooks({
      transactions: [
        transfer({
          id: 'tx1',
          type: 'deposit',
          fromCashbox: null,
          toCashbox: { id: 'cashbox-1', name: 'Main' },
          note: 'Manual deposit note text',
        }),
      ],
    });
    setupPreferences();
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Manual deposit note text' }));
    expect(screen.getByText('Transaction note')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter note...')).toHaveValue('Manual deposit note text');
  });

  it('editing and saving calls PATCH API via updateFinanceTransaction and closes modal', async () => {
    mutableState.activeTab = 'transactions';
    setupHooks({
      transactions: [
        transfer({
          id: 'tx2',
          type: 'withdraw',
          fromCashbox: { id: 'cashbox-1', name: 'Main' },
          toCashbox: null,
          note: 'Old note',
        }),
      ],
    });
    setupPreferences();
    const onSuccess = vi.fn();
    renderPanel({ onSuccess });

    fireEvent.click(screen.getByRole('button', { name: 'Old note' }));
    const dialog = screen.getByRole('dialog', { name: 'Transaction note' });
    const textarea = within(dialog).getByPlaceholderText('Enter note...');

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Updated manual note' } });
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    });

    await waitFor(() => {
      expect(updateFinanceTransactionMock).toHaveBeenCalledWith('tx2', {
        note: 'Updated manual note',
      });
    });
    await waitFor(() => {
      expect(screen.queryByText('Transaction note')).not.toBeInTheDocument();
    });
    expect(onSuccess).toHaveBeenCalledWith('Note updated.');
  });

  it('cancelling note edit does not call API', async () => {
    mutableState.activeTab = 'transactions';
    setupHooks({
      transactions: [
        transfer({
          id: 'tx3',
          type: 'deposit',
          fromCashbox: null,
          toCashbox: { id: 'cashbox-1', name: 'Main' },
          note: 'Something',
        }),
      ],
    });
    setupPreferences();
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Something' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(updateFinanceTransactionMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Transaction note')).not.toBeInTheDocument();
  });
});