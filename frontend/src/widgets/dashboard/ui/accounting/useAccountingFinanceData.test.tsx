import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Cashbox,
  FinanceCurrencyConfig,
  FinanceReport,
  FinanceTransaction,
  SupplierOrderPaymentQueueItem,
} from '../../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import { accountingCashboxOrderStorageKey } from '../../model/accounting';
import { useAccountingFinanceData } from './useAccountingFinanceData';

const {
  getCashboxesMock,
  getFinanceCurrenciesMock,
  getFinanceReportMock,
  getFinanceTransactionsMock,
  getSupplierOrdersForPaymentMock,
  getSupplierOrdersMock,
} = vi.hoisted(() => ({
  getCashboxesMock: vi.fn(),
  getFinanceCurrenciesMock: vi.fn(),
  getFinanceReportMock: vi.fn(),
  getFinanceTransactionsMock: vi.fn(),
  getSupplierOrdersForPaymentMock: vi.fn(),
  getSupplierOrdersMock: vi.fn(),
}));

vi.mock('../../../../entities/finance/api/financeApi', () => {
  return {
    getCashboxes: getCashboxesMock,
    getFinanceCurrencies: getFinanceCurrenciesMock,
    getFinanceReport: getFinanceReportMock,
    getFinanceTransactions: getFinanceTransactionsMock,
    getSupplierOrdersForPayment: getSupplierOrdersForPaymentMock,
    useCashboxesQuery: (options: { includeArchived?: boolean } = {}) =>
      useQuery({
        queryFn: () => getCashboxesMock({ includeArchived: options.includeArchived }),
        queryKey: options.includeArchived
          ? ['financeCashboxes', 'all']
          : ['financeCashboxes'],
        retry: false,
      }),
    useFinanceCurrenciesQuery: (
      options: { includeArchived?: boolean } = {},
    ) =>
      useQuery({
        queryFn: () =>
          getFinanceCurrenciesMock({ includeArchived: options.includeArchived }),
        queryKey: options.includeArchived
          ? ['financeCurrencies', 'all']
          : ['financeCurrencies'],
        retry: false,
      }),
    useFinanceReportQuery: () =>
      useQuery({
        queryFn: getFinanceReportMock,
        queryKey: ['financeReport'],
        retry: false,
      }),
    useFinanceTransactionsQuery: () =>
      useQuery({
        queryFn: getFinanceTransactionsMock,
        queryKey: ['financeTransactions'],
        retry: false,
      }),
    useSupplierOrdersForPaymentQuery: () =>
      useQuery({
        queryFn: getSupplierOrdersForPaymentMock,
        queryKey: ['financeSupplierOrdersQueue'],
        retry: false,
      }),
  };
});

vi.mock('../../../../entities/supplier-order/api/supplierOrderApi', () => {
  return {
    getSupplierOrders: getSupplierOrdersMock,
    useSupplierOrdersQuery: () =>
      useQuery({
        queryFn: getSupplierOrdersMock,
        queryKey: ['supplierOrders'],
        retry: false,
      }),
  };
});

const cashbox = (patch: Partial<Cashbox> = {}): Cashbox => ({
  id: 'cashbox-1',
  name: 'Main',
  balances: { UAH: 100 },
  enabledCurrencies: { UAH: true },
  isDefault: false,
  isArchived: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...patch,
});

const currency = (
  patch: Partial<FinanceCurrencyConfig> = {},
): FinanceCurrencyConfig => ({
  id: 'currency-uah',
  code: 'UAH',
  isSystem: true,
  isArchived: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...patch,
});

const transaction = (
  patch: Partial<FinanceTransaction> = {},
): FinanceTransaction => ({
  id: 'transaction-1',
  type: 'deposit',
  amount: 100,
  currency: 'UAH',
  fromCashbox: null,
  toCashbox: { id: 'cashbox-1', name: 'Main' },
  note: '',
  transactionDate: '2026-06-01T00:00:00.000Z',
  status: 'active',
  isCancellation: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  ...patch,
});

const report = (patch: Partial<FinanceReport> = {}): FinanceReport => ({
  totals: { UAH: 100 },
  cashboxCount: 1,
  transactionCount: 1,
  todayTransactionCount: 1,
  todayTurnover: { UAH: 100 },
  ...patch,
});

const queueItem = (
  patch: Partial<SupplierOrderPaymentQueueItem> = {},
): SupplierOrderPaymentQueueItem => ({
  id: 'queue-1',
  orderBaseId: 'order-base-1',
  number: 'SO-1',
  supplierName: 'Supplier',
  deliveryDate: '2026-06-01',
  total: 100,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...patch,
});

const supplierOrder = (patch: Partial<SupplierOrder> = {}): SupplierOrder =>
  ({
    id: 'supplier-order-1',
    baseId: 'order-base-1',
    number: 'SO-1',
    supplierId: 'supplier-1',
    supplierName: 'Supplier',
    items: [],
    status: 'new',
    paymentStatus: 'unpaid',
    total: 100,
    paidAmount: 0,
    deliveryDate: '2026-06-01',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...patch,
  }) as SupplierOrder;

const mockSuccessfulApi = () => {
  getCashboxesMock.mockImplementation(async (options?: { includeArchived?: boolean }) =>
    options?.includeArchived
      ? [
          cashbox({ id: 'cashbox-1', name: 'Main' }),
          cashbox({ id: 'cashbox-2', name: 'Reserve', isArchived: true }),
        ]
      : [
          cashbox({ id: 'cashbox-1', name: 'Main' }),
          cashbox({ id: 'cashbox-2', name: 'Reserve' }),
        ],
  );
  getFinanceTransactionsMock.mockResolvedValue([transaction()]);
  getFinanceCurrenciesMock.mockResolvedValue([currency()]);
  getFinanceReportMock.mockResolvedValue(report());
  getSupplierOrdersForPaymentMock.mockResolvedValue([queueItem()]);
  getSupplierOrdersMock.mockResolvedValue([supplierOrder()]);
};

const noop = () => undefined;

const renderWithQueryClient = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const Harness = ({ onError = noop }: { onError?: (message: string) => void }) => {
  const state = useAccountingFinanceData({ onError });
  return (
    <section>
      <span data-testid='loading'>{String(state.isLoading)}</span>
      <span data-testid='cashboxes'>
        {state.cashboxes.map((item) => item.id).join(',')}
      </span>
      <span data-testid='all-cashboxes'>{state.allCashboxes.length}</span>
      <span data-testid='transactions'>{state.transactions.length}</span>
      <span data-testid='currencies'>{state.currencies.length}</span>
      <span data-testid='report'>{state.report?.transactionCount ?? 0}</span>
      <span data-testid='queue'>{state.supplierOrdersQueue.length}</span>
      <span data-testid='orders'>{state.supplierOrders.length}</span>
      <span data-testid='hydrated'>{String(state.isCashboxesOrderHydrated)}</span>
      <button type='button' onClick={() => void state.refreshFinance()}>
        refresh
      </button>
    </section>
  );
};

describe('useAccountingFinanceData', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('loads finance data and applies stored cashbox order', async () => {
    mockSuccessfulApi();
    window.localStorage.setItem(
      accountingCashboxOrderStorageKey,
      JSON.stringify(['cashbox-2', 'missing', 'cashbox-1']),
    );

    renderWithQueryClient(<Harness />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await waitFor(() =>
      expect(screen.getByTestId('cashboxes')).toHaveTextContent('cashbox-2,cashbox-1'),
    );
    expect(screen.getByTestId('all-cashboxes')).toHaveTextContent('2');
    expect(screen.getByTestId('transactions')).toHaveTextContent('1');
    expect(screen.getByTestId('currencies')).toHaveTextContent('1');
    expect(screen.getByTestId('report')).toHaveTextContent('1');
    expect(screen.getByTestId('queue')).toHaveTextContent('1');
    expect(screen.getByTestId('orders')).toHaveTextContent('1');
    expect(screen.getByTestId('hydrated')).toHaveTextContent('true');
    expect(getCashboxesMock).toHaveBeenCalledWith({ includeArchived: true });
  });

  it('falls back when stored cashbox order is invalid and refreshes from events', async () => {
    mockSuccessfulApi();
    window.localStorage.setItem(accountingCashboxOrderStorageKey, '{bad json');

    renderWithQueryClient(<Harness />);

    await waitFor(() => expect(screen.getByTestId('cashboxes')).toHaveTextContent('cashbox-1,cashbox-2'));
    window.dispatchEvent(new Event('project-goods:finance-updated'));
    await waitFor(() => expect(getFinanceReportMock).toHaveBeenCalledTimes(2));
  });

  it('ignores a parsed stored cashbox order when it is not an array', async () => {
    mockSuccessfulApi();
    window.localStorage.setItem(
      accountingCashboxOrderStorageKey,
      JSON.stringify({ first: 'cashbox-2' }),
    );

    renderWithQueryClient(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId('cashboxes')).toHaveTextContent(
        'cashbox-1,cashbox-2',
      ),
    );
  });

  it('uses the default cashbox order when nothing is stored', async () => {
    mockSuccessfulApi();

    renderWithQueryClient(<Harness />);

    await waitFor(() =>
      expect(screen.getByTestId('cashboxes')).toHaveTextContent(
        'cashbox-1,cashbox-2',
      ),
    );
  });

  it('reports load errors and leaves loading state', async () => {
    const onError = vi.fn();
    getCashboxesMock.mockRejectedValue(new Error('network down'));

    renderWithQueryClient(<Harness onError={onError} />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(onError).toHaveBeenCalledWith('network down');
  });

  it('uses the generic error message for non-error failures', async () => {
    const onError = vi.fn();
    getCashboxesMock.mockRejectedValue('boom');

    renderWithQueryClient(<Harness onError={onError} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Failed to load finance data.'));
  });
});
