import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import type { FinanceOverview } from '../../model/accounting';
import { AccountingReportsView } from './AccountingReportsView';

const cashboxesHookSpy = vi.fn();

const mockCashboxesReport = {
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
  currencies: ['UAH', 'USD'],
  allCurrencies: ['UAH', 'USD'],
  cashboxes: [{ id: 'cb1', name: 'Main UAH', balances: { UAH: 5000, USD: 200 }, isArchived: false }],
  byCurrency: {
    UAH: {
      currency: 'UAH',
      currentBalance: 5000,
      inflows: 3000,
      outflows: 1000,
      netExternalCashflow: 2000,
      inflowsCount: 3,
      outflowsCount: 1,
      transfersVolume: 500,
      transfersCount: 1,
      transfersIn: 500,
      transfersOut: 500,
      reconciliation: {
        currentBalance: 5000,
        openingBalance: null,
        closingBalance: null,
        reconciliationDelta: null,
        reconciled: false,
        complete: false,
        perCashbox: [
          {
            cashboxId: 'cb1',
            name: 'Main UAH',
            currency: 'UAH',
            currentBalance: 5000,
            openingBalance: null,
            closingBalance: null,
            inflows: 3000,
            outflows: 1000,
            transfersIn: 500,
            transfersOut: 500,
            reconciliationDelta: null,
          },
        ],
      },
      comparison: {
        inflowsPrev: 2500,
        outflowsPrev: 1000,
        netExternalCashflowPrev: 1500,
        inflowsDeltaPct: 20,
        outflowsDeltaPct: 0,
      },
      trend: [{ dateKey: '2026-11-10', inflows: 3000, outflows: 1000, netExternal: 2000, transfers: 500 }],
      forecast: {
        isEstimate: true,
        horizonDays: 30 as const,
        startingBalance: 5000,
        avgDailyInflow: 100,
        avgDailyOutflow: 33.33,
        adjustedDailyInflow: 100,
        adjustedDailyOutflow: 33.33,
        totalProjectedBaselineInflows: 3000,
        totalProjectedBaselineOutflows: 999.9,
        totalPlannedInflows: 0,
        totalPlannedOutflows: 0,
        endingProjectedBalance: 7000.1,
        lowestProjectedBalance: 5000,
        series: [{ day: 1, dateKey: '2026-11-12', baselineInflow: 100, baselineOutflow: 33.33, plannedInflow: 0, plannedOutflow: 0, projectedBalance: 5066.67 }],
      },
    },
    USD: {
      currency: 'USD',
      currentBalance: 200,
      inflows: 200,
      outflows: 0,
      netExternalCashflow: 200,
      inflowsCount: 1,
      outflowsCount: 0,
      transfersVolume: 0,
      transfersCount: 0,
      transfersIn: 0,
      transfersOut: 0,
      reconciliation: {
        currentBalance: 200,
        openingBalance: 0,
        closingBalance: 200,
        reconciliationDelta: 0,
        reconciled: true,
        complete: true,
        perCashbox: [],
      },
      comparison: null,
      trend: [],
      forecast: {
        isEstimate: true,
        horizonDays: 30 as const,
        startingBalance: 200,
        avgDailyInflow: 6.67,
        avgDailyOutflow: 0,
        adjustedDailyInflow: 6.67,
        adjustedDailyOutflow: 0,
        totalProjectedBaselineInflows: 200.1,
        totalProjectedBaselineOutflows: 0,
        totalPlannedInflows: 0,
        totalPlannedOutflows: 0,
        endingProjectedBalance: 400.1,
        lowestProjectedBalance: 206.67,
        series: [],
      },
    },
  },
  assumptions: {
    horizonDays: 30 as const,
    demandMultiplier: 1,
    inflowMultiplier: 1,
    outflowMultiplier: 1,
    inflowTimingShiftDays: 0,
    outflowTimingShiftDays: 0,
    plannedEvents: [],
  },
  unscheduledObligations: [
    {
      obligationKind: 'supplier_order' as const,
      obligationId: 'so-99',
      label: 'Supplier order SO-99',
      type: 'outflow' as const,
      currency: 'UAH',
      amount: 1200,
      dueDate: '2026-11-18',
      isScheduled: false,
    },
  ],
  obligationSummary: {
    unscheduledPayablesTotal: 1200,
    unscheduledReceivablesTotal: 0,
    unscheduledCount: 1,
    scheduledCount: 0,
  },
  coverage: {
    sealedThrough: '2026-10-01',
    purgedBeforeSeal: true,
    purgedTxCount: 12,
    reconciliationUnavailableBySeal: true,
    observedHistoryDays: 40,
    historyWindowDays: 90,
    warnings: ['Transactions on or before 2026-10-01 (12 purged) are sealed; opening balance and full period reconciliation are unavailable inside the sealed purge window.'],
  },
};

vi.mock('../../../../entities/finance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/finance')>();
  return {
    ...actual,
    useCashboxesReportQuery: (params: unknown) => {
      cashboxesHookSpy(params);
      return { data: mockCashboxesReport, isLoading: false, isError: false };
    },
    useCashboxesReportDetailsQuery: () => ({
      data: { items: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock('../../../../entities/scenario', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/scenario')>();
  return {
    ...actual,
    useScenariosQuery: () => ({ data: [], isLoading: false }),
    useCreateScenarioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateScenarioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteScenarioMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

afterEach(() => {
  cleanup();
  cashboxesHookSpy.mockReset();
});

const emptyOverview: FinanceOverview = {
  activeCashboxCount: 1,
  archivedCashboxCount: 0,
  transactionCount: 4,
  todayTransactionCount: 1,
  pendingSupplierTotal: 1200,
  pendingSupplierCount: 1,
  currencyRows: [],
  todayByType: { deposit: {}, withdraw: {}, transfer: {} },
  recentTransactions: [],
};

describe('AccountingReportsView (Cashboxes Information)', () => {
  it('keeps currencies separate, shows seal coverage warning, and schedules unscheduled obligations cleanly', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={i18n}>
          <AccountingReportsView financeOverview={emptyOverview} />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    expect(screen.getAllByText(/sealed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Internal transfers \(shown separately\)/)).toBeInTheDocument();

    // Schedule unscheduled obligation without double-counting
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(cashboxesHookSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plannedEvents: expect.arrayContaining([
          expect.objectContaining({
            obligationKind: 'supplier_order',
            obligationId: 'so-99',
            scheduledDate: '2026-11-18',
          }),
        ]),
      }),
    );

    // Switch currency tab USD separately
    fireEvent.click(screen.getByRole('tab', { name: 'USD' }));
    expect(screen.getByText('Current Balance (USD)')).toBeInTheDocument();
  });
});
