import {
  cleanup,
  fireEvent,
  render,
  screen,
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
import type { FinanceProfitReport } from '../../../../entities/finance/model/types';
import i18n from '../../../../shared/i18n/config';
import { AccountingProfitReportsView } from './AccountingProfitReportsView';

const { report, exportMock } = vi.hoisted(() => {
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
  };
  return { report, exportMock: vi.fn() };
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

vi.mock('../../../../entities/finance/api/financeApi', () => ({
  useFinanceProfitReportQuery: () => ({
    data: report,
    isLoading: false,
    isError: false,
  }),
  useFinanceCategoriesQuery: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('../../../../entities/product/api/productApi', () => ({
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
}));

vi.mock(
  '../../../../entities/warehouse-settings/api/warehouseSettingsApi',
  () => ({
    useWarehouseSettingsQuery: () => ({
      data: { warehouses: [] },
      isLoading: false,
      isError: false,
    }),
  }),
);

vi.mock('../../../../entities/sale/api/saleApi', () => ({
  getOccupiedSerialNumbers: vi.fn(async () => ({ occupied: [] })),
}));

vi.mock(
  '../../../../entities/service-catalog/api/serviceCatalogApi',
  () => ({
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
  }),
);

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
});
