import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  FinancePolicy,
  FinanceProfitReport,
} from '../../../../entities/finance';
import type { Employee } from '../../../../entities/employee';
import i18n from '../../../../shared/i18n/config';
import { AccountingProfitReportsView } from './AccountingProfitReportsView';

const { report, exportMock, mockPolicyState } = vi.hoisted(() => {
  const mockPolicyState: { data: FinancePolicy } = {
    data: {
      serviceAuditEnabled: false,
      serviceProfitMode: 'full',
      reportDefaults: {
        period: 'last30',
        source: 'all',
        showCharts: true,
        showTable: true,
      },
      version: 1,
      updatedById: null,
      updatedByName: null,
      updatedAt: null,
    },
  };
  const report: FinanceProfitReport = {
    period: {
      key: 'whole',
      dateFrom: null,
      dateTo: null,
      timeZone: 'Europe/Kiev',
    },
    source: 'all',
    currency: 'UAH',
    otherCurrencies: [],
    margin: {
      revenue: 840,
      cogs: 330,
      grossProfit: 510,
      grossMarginPct: 60.7,
      unknownCostCount: 0,
    },
    cash: {
      collected: 500,
      inventoryPurchases: 100,
      opex: 50,
      refunds: 0,
      net: 350,
      opexByCategory: [{ category: 'rent', amount: 50, count: 1 }],
      operations: [
        {
          type: 'withdraw',
          category: 'rent',
          amount: 50,
          currency: 'UAH',
          note: 'Shop rent',
          transactionDate: '2026-09-01T10:00:00.000Z',
        },
      ],
    },
    rows: [
      {
        key: 'product:p1',
        name: 'Battery',
        type: 'product',
        quantity: 1,
        cost: 200,
        revenue: 500,
        profit: 300,
        marginPct: 60,
        costKnown: true,
        catalogProductId: 'cp1',
        serviceId: null,
      },
      {
        key: 'product:p2',
        name: 'Screen',
        type: 'product',
        quantity: 1,
        cost: 80,
        revenue: 100,
        profit: 20,
        marginPct: 20,
        costKnown: true,
        catalogProductId: null,
        serviceId: null,
      },
      {
        key: 'service:s1',
        name: 'Diagnostics',
        type: 'service',
        quantity: 1,
        cost: 0,
        revenue: 200,
        profit: 200,
        marginPct: 100,
        costKnown: true,
        catalogProductId: null,
        serviceId: 's1',
      },
      {
        key: 'product:p3',
        name: 'Cable',
        type: 'product',
        quantity: 1,
        cost: 50,
        revenue: 40,
        profit: -10,
        marginPct: -25,
        costKnown: true,
        catalogProductId: null,
        serviceId: null,
      },
      {
        key: 'product:p-perfume-1',
        name: 'Perfume',
        type: 'product',
        quantity: 5,
        cost: 100,
        revenue: 250,
        profit: 150,
        marginPct: 60,
        costKnown: true,
        catalogProductId: null,
        serviceId: null,
      },
      {
        key: 'product:p-perfume-2',
        name: 'Perfume',
        type: 'product',
        quantity: 4,
        cost: 100,
        revenue: 150,
        profit: 50,
        marginPct: 33.3,
        costKnown: true,
        catalogProductId: null,
        serviceId: null,
      },
    ],
    dataScope: 'live_sales_only',
    coldSalesPurgedExist: false,
    saleCount: 1,
    trendSeries: [
      {
        dateKey: '2026-09-01',
        revenue: 500,
        knownCost: 200,
        knownProfit: 300,
        cashCollected: 500,
        cashOutflows: 150,
        cashNet: 350,
      },
    ],
  };
  return { report, exportMock: vi.fn(), mockPolicyState };
});

vi.mock('../../model/profit-report', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../model/profit-report')
    >();
  return {
    ...actual,
    exportProfitReportWorkbook: (...args: unknown[]) =>
      exportMock(...args),
  };
});

vi.mock('../../../../entities/finance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/finance')>();
  return {
    ...actual,
  useFinanceProfitReportQuery: () => ({
    data: report,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useFinanceProfitReportDetailsQuery: () => ({
    data: {
      items: [
        {
          id: 'sale-1',
          recordNumber: 'S000101',
          kind: 'sale',
          status: 'paid',
          saleDate: '2026-09-15T10:00:00.000Z',
          clientName: 'Alice',
          revenue: 500,
          knownCostRevenue: 500,
          knownCost: 300,
          knownProfit: 200,
          profit: 200,
          marginPct: 40,
          isIncomplete: false,
          missingCostCount: 0,
          knownCostCount: 1,
          isLoss: false,
          matchingLineCount: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totals: {
        revenue: 500,
        knownCost: 300,
        knownProfit: 200,
        missingCostRecordsCount: 0,
        lossRecordsCount: 0,
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useFinanceCategoriesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
  useFinancePolicyQuery: () => ({
    data: mockPolicyState.data,
    isLoading: false,
    isError: false,
  }),
  };
});

vi.mock('../../../../entities/product', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/product')>();
  return {
    ...actual,
  useProductsQuery: () => ({
    data: [
      {
        id: 'p1',
        name: 'Battery',
        article: 'BAT-1',
        serialNumber: 'S000611',
        price: 174.56,
        salePriceOptions: [200],
        note: '',
        quantity: 1,
        reservedQuantity: 0,
        freeQuantity: 1,
        isInStock: true,
        purchasePlace: '',
        purchaseDate: '2026-09-15',
        warrantyPeriod: 0,
        isActive: true,
        createdAt: '2026-09-15T00:00:00.000Z',
        updatedAt: '2026-09-15T00:00:00.000Z',
      },
    ],
    isLoading: false,
    isError: false,
  }),
  updateProductModelByName: vi.fn(async () => ({
    matchedCount: 1,
    products: [],
  })),
  };
});

vi.mock('../../../../entities/warehouse-settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/warehouse-settings')>();
  return {
    ...actual,
    useWarehouseSettingsQuery: () => ({
      data: { warehouses: [] },
      isLoading: false,
      isError: false,
    }),
    };
});

vi.mock('../../../../entities/sale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/sale')>();
  return {
    ...actual,
  getOccupiedSerialNumbers: vi.fn(async () => ({ occupied: [] })),
  };
});

vi.mock('../../../../entities/service-catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/service-catalog')>();
  return {
    ...actual,
    useServicesQuery: () => ({
      data: [
        {
          id: 's1',
          name: 'Diagnostics',
          price: 200,
          salePriceOptions: [],
          note: '',
          isActive: true,
          createdAt: '',
          updatedAt: '',
        },
      ],
      isLoading: false,
      isError: false,
    }),
    updateServiceCatalogItem: vi.fn(),
    archiveServiceCatalogItem: vi.fn(),
    };
});

const renderView = (ui: ReactElement) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      {ui}
    </QueryClientProvider>,
  );

describe('AccountingProfitReportsView', () => {
  beforeEach(async () => {
    exportMock.mockReset();
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders margin and cash KPIs and exports the current report', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    expect(
      screen.getByRole('heading', { name: 'Reports' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Battery' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.getByText('Top items')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Export Excel' }),
    );

    expect(exportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        report,
        filename: 'profit-report_all_all-time_all-time.xlsx',
      }),
    );
  });

  it('filters the margin table by name search and analyzes a selected group', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    fireEvent.change(
      screen.getByPlaceholderText('Product or service name'),
      {
        target: { value: 'Batt' },
      },
    );
    expect(
      screen.getByRole('button', { name: 'Battery' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Screen')).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText('Product or service name'),
      {
        target: { value: '' },
      },
    );
    fireEvent.click(screen.getByLabelText('Select Battery'));
    expect(screen.getByText('Analyzing 1 items')).toBeInTheDocument();
  });

  it('opens the product model for goods and the service catalog for services', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Screen' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Battery' }));
    expect(screen.getByText('Product model')).toBeInTheDocument();
    expect(screen.getByText('Retail price')).toBeInTheDocument();
    expect(
      screen.getByText('Purchase by serial'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Diagnostics' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Diagnostics' }),
    ).toBeInTheDocument();
  });

  it('hides charts from visual settings', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Report visual settings' }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Show charts' }),
    );
    expect(screen.queryByText('Top items')).not.toBeInTheDocument();
  });

  it('does not filter the table when a leaders row is clicked', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    screen
      .getAllByTitle('Battery')
      .forEach((node) => fireEvent.click(node));
    expect(
      screen.getByPlaceholderText('Product or service name'),
    ).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Screen' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /Filter table to Battery/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('ranks leaders and top three by pieces when the header toggle changes', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'UAH' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'pcs' }));
    expect(screen.getAllByText('9 pcs').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'UAH' }));
    expect(screen.queryByText('9 pcs')).not.toBeInTheDocument();
  });

  it('groups duplicate names and expands children with per-row figures', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    expect(
      screen.getByLabelText('Select group Perfume'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 pcs')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Select Perfume'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Expand group Perfume' }),
    );
    expect(screen.getAllByLabelText('Select Perfume')).toHaveLength(
      2,
    );
    expect(screen.getByText('33.3%')).toBeInTheDocument();
    expect(screen.getAllByText('250.00 UAH').length).toBeGreaterThan(
      0,
    );
  });

  it('supports lossOnly / missingCostOnly toggles, comparison notice for all-time, and Audit Costs trigger', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView
          currentEmployee={{
            id: 'emp-1',
            name: 'Accountant',
            phone: '',
            email: '',
            username: 'acc',
            role: 'accountant',
            permissions: ['finance.view', 'sales.manage'],
            isActive: true,
            isRegistered: true,
            note: '',
            createdAt: '',
            updatedAt: '',
          }}
        />
      </I18nextProvider>,
    );

    const lossChip = screen.getByRole('button', { name: 'Loss records only' });
    const missingChip = screen.getByRole('button', { name: 'Missing cost only' });
    fireEvent.click(lossChip);
    fireEvent.click(missingChip);
    expect(lossChip).toHaveAttribute('aria-pressed', 'true');
    expect(missingChip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'All time' }));
    expect(
      screen.getByText(/Comparison indicators are disabled for the All-time period/),
    ).toBeInTheDocument();

    expect(screen.getByText('Source Orders & Repairs Drill-Down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Audit Costs' })).toBeInTheDocument();
  });

  it('switches the Mix chart metric inline and persists it to visual settings', () => {
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    const mixMetricGroup = screen.getByRole('tablist', {
      name: 'Mix chart metric',
    });
    const revenueBtn = within(mixMetricGroup).getByRole('button', {
      name: 'Revenue',
    });
    fireEvent.click(revenueBtn);
    expect(revenueBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Service: 16% · 200\.00 UAH/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Report visual settings' }),
    );
    expect(screen.getByLabelText('Chart metric')).toHaveValue('revenue');
  });

  it('applies company defaults, prioritizes personal overrides, resets on button click, and disables Services in exclude mode', () => {
    window.localStorage.clear();
    mockPolicyState.data = {
      serviceAuditEnabled: false,
      serviceProfitMode: 'exclude',
      reportDefaults: {
        period: 'month',
        source: 'sales',
        showCharts: false,
        showTable: false,
      },
      version: 4,
      updatedById: null,
      updatedByName: null,
      updatedAt: null,
    };

    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView />
      </I18nextProvider>,
    );

    // Company defaults applied: period=month, source=sales, showTable=false
    expect(screen.getByRole('button', { name: 'Month' })).toHaveClass(
      'period-button-active',
    );
    expect(screen.getByRole('button', { name: 'Sales' })).toHaveClass(
      'period-button-active',
    );
    expect(
      screen.queryByRole('heading', { name: 'Margin by product or service' }),
    ).not.toBeInTheDocument();

    // Services button disabled with explanation in exclude mode
    const servicesBtn = screen.getByRole('button', { name: 'Services' });
    expect(servicesBtn).toBeDisabled();
    expect(
      screen.getByText(/Services filter is unavailable while services are excluded/i),
    ).toBeInTheDocument();

    // Personal override takes priority and persists
    fireEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(screen.getByRole('button', { name: 'Year' })).toHaveClass(
      'period-button-active',
    );
    expect(
      window.localStorage.getItem('project-goods.accounting-profit-filters'),
    ).toContain('"period":"year"');

    // Reset to company defaults restores period=month and clears personal storage
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset to company defaults' }),
    );
    expect(screen.getByRole('button', { name: 'Month' })).toHaveClass(
      'period-button-active',
    );
    expect(
      window.localStorage.getItem('project-goods.accounting-profit-filters'),
    ).toBeNull();

    // Restore mockPolicyState for other tests
    mockPolicyState.data = {
      serviceAuditEnabled: false,
      serviceProfitMode: 'full',
      reportDefaults: {
        period: 'last30',
        source: 'all',
        showCharts: true,
        showTable: true,
      },
      version: 1,
      updatedById: null,
      updatedByName: null,
      updatedAt: null,
    };
  });

  it('renders Ukrainian copy when the interface language is uk', async () => {
    await i18n.changeLanguage('uk');
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView
          currentEmployee={{
            id: 'emp-1',
            name: 'Accountant',
            phone: '',
            email: '',
            username: 'acc',
            role: 'accountant',
            permissions: ['finance.view', 'sales.manage'],
            isActive: true,
            isRegistered: true,
            note: '',
            createdAt: '',
            updatedAt: '',
          }}
        />
      </I18nextProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Звіти' })).toBeInTheDocument();
    expect(screen.getAllByText('Виручка').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Валовий прибуток').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Маржа').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Лише збиткові записи' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Лише без собівартості' })).toBeInTheDocument();
    expect(screen.getByText('Деталізація вихідних замовлень і ремонтів')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Аудит собівартості' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Експорт Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Останні 30 днів' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Пошук за № замовлення або клієнтом...')).toBeInTheDocument();
    expect(screen.getByText('Оренда')).toBeInTheDocument();
    expect(screen.getByText('Топ позицій')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Весь час' }));
    expect(
      screen.getByText(/Індикатори порівняння вимкнено для періоду/),
    ).toBeInTheDocument();
  });

  it('renders all 8 Accounting Reports sections as independent collapsible cards, does not collapse KPIs, and preserves state across visual toggles and employee switch', async () => {
    await i18n.changeLanguage('en');
    window.localStorage.clear();

    const employee1: Employee = {
      id: 'emp-rep-1',
      name: 'Accountant One',
      phone: '',
      email: '',
      username: 'acc1',
      role: 'accountant',
      permissions: ['finance.view', 'sales.manage'],
      isActive: true,
      isRegistered: true,
      note: '',
      createdAt: '',
      updatedAt: '',
    };

    const employee2: Employee = {
      ...employee1,
      id: 'emp-rep-2',
      name: 'Accountant Two',
      username: 'acc2',
    };

    const { unmount } = renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView currentEmployee={employee1} />
      </I18nextProvider>,
    );

    // 1. Top KPI panels (Gross result, Cash result) DO NOT have collapse buttons
    expect(
      screen.queryByRole('button', { name: /Gross result/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Cash result/i }),
    ).not.toBeInTheDocument();

    // 2. All 8 Report sections have toggle buttons and are open by default
    const trendBtn = screen.getByRole('button', {
      name: /Revenue, Known Cost & Known Profit Trend/i,
    });
    const mixBtn = screen.getByRole('button', {
      name: /Products and services/i,
    });
    const topItemsBtn = screen.getByRole('button', {
      name: /Top items/i,
    });
    const topThreeBtn = screen.getByRole('button', {
      name: /Top three/i,
    });
    const cashflowBtn = screen.getByRole('button', {
      name: /Money in and out/i,
    });
    const marginTableBtn = screen.getByRole('button', {
      name: /Margin by product or service/i,
    });
    const withdrawalsBtn = screen.getByRole('button', {
      name: /Withdrawals by category/i,
    });
    const drillDownBtn = screen.getByRole('button', {
      name: /Source Orders & Repairs Drill-Down/i,
    });

    expect(trendBtn).toHaveAttribute('aria-expanded', 'true');
    expect(mixBtn).toHaveAttribute('aria-expanded', 'true');
    expect(topItemsBtn).toHaveAttribute('aria-expanded', 'true');
    expect(topThreeBtn).toHaveAttribute('aria-expanded', 'true');
    expect(cashflowBtn).toHaveAttribute('aria-expanded', 'true');
    expect(marginTableBtn).toHaveAttribute('aria-expanded', 'true');
    expect(withdrawalsBtn).toHaveAttribute('aria-expanded', 'true');
    expect(drillDownBtn).toHaveAttribute('aria-expanded', 'true');

    expect(trendBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-profit-trend-content',
    );
    expect(mixBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-products-services-content',
    );
    expect(topItemsBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-leaders-top-items-content',
    );
    expect(topThreeBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-leaders-top-three-content',
    );
    expect(cashflowBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-cashflow-content',
    );
    expect(marginTableBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-margin-by-item-content',
    );
    expect(withdrawalsBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-withdrawals-by-category-content',
    );
    expect(drillDownBtn).toHaveAttribute(
      'aria-controls',
      'accounting-reports-source-drill-down-content',
    );

    // 3. Mouse click collapses Margin Table
    const marginContent = document.getElementById(
      'accounting-reports-margin-by-item-content',
    );
    fireEvent.click(marginTableBtn);
    expect(marginTableBtn).toHaveAttribute('aria-expanded', 'false');
    expect(marginContent).toHaveAttribute('hidden');

    // 4. Keyboard Space collapses Profit Trend
    const trendContent = document.getElementById(
      'accounting-reports-profit-trend-content',
    );
    fireEvent.keyDown(trendBtn, { key: ' ', code: 'Space' });
    fireEvent.click(trendBtn);
    expect(trendBtn).toHaveAttribute('aria-expanded', 'false');
    expect(trendContent).toHaveAttribute('hidden');

    // 5. Keyboard Enter collapses Withdrawals
    const withdrawalsContent = document.getElementById(
      'accounting-reports-withdrawals-by-category-content',
    );
    fireEvent.keyDown(withdrawalsBtn, { key: 'Enter', code: 'Enter' });
    fireEvent.click(withdrawalsBtn);
    expect(withdrawalsBtn).toHaveAttribute('aria-expanded', 'false');
    expect(withdrawalsContent).toHaveAttribute('hidden');

    // 6. Visual setting toggle does NOT reset localStorage collapse state
    fireEvent.click(
      screen.getByRole('button', { name: 'Report visual settings' }),
    );
    const compactToggle = screen.getByLabelText('Compact table');
    fireEvent.click(compactToggle);

    expect(
      screen.getByRole('button', {
        name: /Margin by product or service/i,
      }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', {
        name: /Revenue, Known Cost & Known Profit Trend/i,
      }),
    ).toHaveAttribute('aria-expanded', 'false');

    // 7. Remount preserves collapsed state for emp-rep-1
    unmount();
    const { unmount: unmount2 } = renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView currentEmployee={employee1} />
      </I18nextProvider>,
    );
    expect(
      screen.getByRole('button', {
        name: /Margin by product or service/i,
      }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('button', {
        name: /Revenue, Known Cost & Known Profit Trend/i,
      }),
    ).toHaveAttribute('aria-expanded', 'false');

    // 8. Isolation for emp-rep-2 (all open by default)
    unmount2();
    renderView(
      <I18nextProvider i18n={i18n}>
        <AccountingProfitReportsView currentEmployee={employee2} />
      </I18nextProvider>,
    );
    expect(
      screen.getByRole('button', {
        name: /Margin by product or service/i,
      }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('button', {
        name: /Revenue, Known Cost & Known Profit Trend/i,
      }),
    ).toHaveAttribute('aria-expanded', 'true');
  });
});
