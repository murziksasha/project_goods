import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../../shared/i18n/config';
import { OrdersInformationWorkspace } from './OrdersInformationWorkspace';

const repairsHookSpy = vi.fn();
const salesHookSpy = vi.fn();
const procHookSpy = vi.fn();

const mockRepairsReport = {
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
  summary: {
    openCount: 3,
    unassignedOpenCount: 1,
    intakeCount: 5,
    trackedCompletedCount: 2,
    untrackedCompletedCount: 1,
    totalCompletedCount: 3,
    avgTurnaroundHours: 14.5,
    medianTurnaroundHours: 12,
  },
  comparison: {
    intakeCountPrev: 4,
    intakeDeltaPct: 25,
    completedCountPrev: 2,
    completedDeltaPct: 50,
    avgTurnaroundHoursPrev: 16,
  },
  byStatus: [{ status: 'inProgress', count: 2 }],
  byTechnician: [
    { technicianId: 't1', name: 'Alex', openCount: 2, completedInPeriod: 2 },
    { technicianId: null, name: 'Unassigned', openCount: 1, completedInPeriod: 0 },
  ],
  openAgingBuckets: [{ bucket: '0-3', count: 2 }, { bucket: '30+', count: 1 }],
  completionTrend: [{ dateKey: '2026-11-10', completedCount: 2, avgTurnaroundHours: 14.5 }],
  turnaroundCoverage: {
    trackedCount: 2,
    untrackedCount: 1,
    totalClosedCount: 3,
    coveragePct: 66.7,
    available: true,
    warning: '1 closed repair lacks structured completion timestamp.',
  },
  coverage: { coldSalesPurgedExist: false, warnings: [] },
};

const mockSalesReport = {
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
  summary: {
    ordersCount: 4,
    unitsSold: 7,
    grossRevenue: 4000,
    discountAmount: 200,
    netRevenue: 3800,
    collectedAmount: 3800,
    aov: 950,
    returnsCount: 1,
    returnedUnits: 1,
    returnedAmount: 300,
    refundedAmount: 300,
  },
  comparison: {
    netRevenuePrev: 3000,
    netRevenueDeltaPct: 26.7,
    ordersCountPrev: 3,
    ordersCountDeltaPct: 33.3,
    unitsSoldPrev: 5,
    unitsSoldDeltaPct: 40,
    aovPrev: 1000,
    aovDeltaPct: -5,
    returnsAmountPrev: 0,
  },
  mix: {
    productRevenue: 3000,
    serviceRevenue: 800,
    productUnits: 5,
    serviceUnits: 2,
    productSharePct: 78.9,
    serviceSharePct: 21.1,
  },
  byStatus: [{ status: 'paid', count: 4, netRevenue: 3800 }],
  topItems: [{ key: 'p1', name: 'SSD 512', kind: 'product' as const, units: 5, revenue: 3000 }],
  trend: [{ dateKey: '2026-11-10', revenue: 3800, ordersCount: 4, units: 7, returnsAmount: 300 }],
  coverage: { coldSalesPurgedExist: false, warnings: [] },
};

const mockProcReport = {
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  period: { key: 'last30', dateFrom: '2026-10-13', dateTo: '2026-11-11' },
  previousPeriod: { dateFrom: '2026-09-13', dateTo: '2026-10-12' },
  summary: {
    ordersCount: 2,
    orderedUnits: 10,
    receivedUnits: 6,
    cancelledUnits: 0,
    pendingUnits: 4,
    totalSpend: 5000,
    paidAmount: 2500,
    outstandingAmount: 2500,
    overdueOrdersCount: 1,
    overduePendingUnits: 4,
  },
  comparison: null,
  receiptPerformance: {
    trackedItemsCount: 1,
    untrackedLegacyItemsCount: 1,
    totalReceivedItemsCount: 2,
    coveragePct: 50,
    onTimeCount: 1,
    lateCount: 0,
    onTimeRatePct: 100,
    avgReceiptLeadDays: 3,
    available: true,
  },
  bySupplier: [],
  byProduct: [],
  trend: [],
  supplierOptions: [],
  coverage: { warnings: ['1 legacy received PO item lacks structured receivedAt timestamp.'] },
};

vi.mock('../../../../entities/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/analytics')>();
  return {
    ...actual,
    useOrdersRepairsReportQuery: (params: unknown, opts?: { enabled?: boolean }) => {
      if (opts?.enabled) repairsHookSpy(params);
      return { data: mockRepairsReport, isLoading: false, isError: false };
    },
    useOrdersRepairsDetailsQuery: () => ({
      data: {
        items: [
          {
            id: 'r1',
            recordNumber: 'R000010',
            saleDate: '2026-11-01T10:00:00.000Z',
            status: 'inProgress',
            clientName: 'John',
            deviceName: 'iPhone',
            serialNumber: 'SN1',
            technicianName: 'Alex',
            technicianId: 't1',
            isOpen: true,
            ageDays: 10,
            ageBucket: '8-14',
            completedAt: null,
            turnaroundHours: null,
            total: 1200,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      },
      isLoading: false,
      isError: false,
    }),
    useOrdersSalesReportQuery: (params: unknown, opts?: { enabled?: boolean }) => {
      if (opts?.enabled) salesHookSpy(params);
      return { data: mockSalesReport, isLoading: false, isError: false };
    },
    useOrdersSalesDetailsQuery: () => ({
      data: { items: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
    }),
    useOrdersProcurementReportQuery: (params: unknown, opts?: { enabled?: boolean }) => {
      if (opts?.enabled) procHookSpy(params);
      return { data: mockProcReport, isLoading: false, isError: false };
    },
    useOrdersProcurementDetailsQuery: () => ({
      data: { items: [], total: 0, page: 1, pageSize: 25 },
      isLoading: false,
      isError: false,
    }),
  };
});

afterEach(() => {
  cleanup();
  repairsHookSpy.mockReset();
  salesHookSpy.mockReset();
  procHookSpy.mockReset();
});

describe('OrdersInformationWorkspace', () => {
  it('enforces Orders subview visibility and executes subview switches and drill-downs', () => {
    const onOpenSaleCard = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={i18n}>
          <OrdersInformationWorkspace
            activeTab="supplierInformation"
            visibleTabs={['orders', 'sales', 'supplierOrders', 'supplierInformation']}
            onActiveTabChange={vi.fn()}
            employees={[]}
            canViewRepairs
            canViewSales
            canViewProcurement={false}
            onOpenSaleCard={onOpenSaleCard}
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // Procurement tab is hidden and never queried when unauthorized
    const subviews = within(screen.getByLabelText('Orders analytics views'));
    expect(subviews.getByRole('tab', { name: 'Repairs' })).toBeInTheDocument();
    expect(subviews.getByRole('tab', { name: 'Sales' })).toBeInTheDocument();
    expect(subviews.queryByRole('tab', { name: 'Procurement' })).not.toBeInTheDocument();
    expect(procHookSpy).not.toHaveBeenCalled();

    // Turnaround warning & order drill-down click
    expect(screen.getByText(/1 closed repair lacks structured completion timestamp/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'R000010' }));
    expect(onOpenSaleCard).toHaveBeenCalledWith({ id: 'r1', kind: 'repair' });

    // Switch period to All time shows disabled comparison notice
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'whole' } });
    expect(
      screen.getByText(/Comparison indicators are disabled for the All-time period/),
    ).toBeInTheDocument();

    // Switch to Sales subview
    fireEvent.click(subviews.getByRole('tab', { name: 'Sales' }));
    expect(salesHookSpy).toHaveBeenCalled();
    expect(screen.getByText('Average Order Value')).toBeInTheDocument();
  });
});
