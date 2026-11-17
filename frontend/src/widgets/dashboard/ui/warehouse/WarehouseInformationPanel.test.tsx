import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../entities/product';
import type { SupplierOrder } from '../../../../entities/supplier-order';
import i18n from '../../../../shared/i18n/config';
import type { WarehouseItem } from '../../model/warehouse-panel';
import { WarehouseInformationPanel } from './WarehouseInformationPanel';

const mockWarehouseReport = {
  generatedAt: '2026-11-11T10:00:00.000Z',
  timeZone: 'Europe/Kiev',
  filtersApplied: {},
  assumptions: {
    leadTimeDays: 14,
    safetyStockDays: 7,
    horizonDays: 30 as const,
    demandMultiplier: 1,
    includePendingSupplierOrders: true,
  },
  summary: {
    skuCount: 2,
    productGroupCount: 2,
    totalQuantity: 6,
    reservedQuantity: 1,
    manualReservedQuantity: 0,
    orderReservedQuantity: 1,
    availableQuantity: 5,
    purchaseValuation: 1000,
    availableValuation: 900,
    outOfStockCount: 0,
    lowStockCount: 1,
    unknownAgeOnHandCount: 1,
    unknownAgeUnits: 2,
    totalObservedDemand90d: 18,
    pendingSupplierUnits: 5,
    reorderSkuCount: 1,
    totalSuggestedReorderUnits: 4,
    totalEstimatedReorderCost: 400,
  },
  agingBuckets: [
    { bucket: '0-30' as const, skuCount: 1, quantity: 4, reservedQuantity: 1, availableQuantity: 3, valuation: 400 },
    { bucket: '31-60' as const, skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
    { bucket: '61-90' as const, skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
    { bucket: '90+' as const, skuCount: 0, quantity: 0, reservedQuantity: 0, availableQuantity: 0, valuation: 0 },
    { bucket: 'unknown' as const, skuCount: 1, quantity: 2, reservedQuantity: 0, availableQuantity: 2, valuation: 600 },
  ],
  distributions: {
    bySupplier: [
      { key: 'Cable Supplier', label: 'Cable Supplier', skuCount: 1, quantity: 4, reservedQuantity: 1, availableQuantity: 3, valuation: 400 },
      { key: 'Legacy Supplier', label: 'Legacy Supplier', skuCount: 1, quantity: 2, reservedQuantity: 0, availableQuantity: 2, valuation: 600 },
    ],
    byLocation: [
      { key: 'w-1::l-1', warehouseId: 'w-1', warehouseName: 'Main', locationId: 'l-1', locationName: 'A1', label: 'Main / A1', skuCount: 1, quantity: 4, reservedQuantity: 1, availableQuantity: 3, valuation: 400 },
    ],
  },
  demandAndSuggestions: [
    {
      nameKey: 'patchcord 1m',
      name: 'Patchcord 1m',
      supplier: 'Cable Supplier',
      onHandQuantity: 4,
      reservedQuantity: 1,
      availableQuantity: 3,
      valuation: 400,
      avgUnitCost: 100,
      pendingSupplierQuantity: 5,
      overdueSupplierQuantity: 0,
      earliestExpectedDelivery: '2026-11-20T00:00:00.000Z',
      observedDemand90d: 18,
      activeDemandDays: 12,
      observedDailyDemand: 0.2,
      projectedDailyDemand: 0.2,
      demandPattern: 'sparse' as const,
      estimatedCoverageDays: 15,
      estimatedCoverageWithPendingDays: 40,
      targetBufferUnits: 5,
      reorderSuggestedQty: 4,
      estimatedReorderCost: 400,
      horizonProjectedDemand: 6,
      horizonProjectedEndingAvailable: 2,
      horizonProjectedShortfall: 0,
      needsReorder: true,
    },
  ],
  forecast: {
    isEstimate: true,
    horizonDays: 30 as const,
    observationWindow: {
      dateFrom: '2026-08-14',
      dateTo: '2026-11-11',
      windowDays: 90,
      observedHistoryDays: 90,
      earliestLiveSaleDate: '2026-06-01T00:00:00.000Z',
    },
    summary: {
      projectedDemandUnits: 6,
      projectedShortfallUnits: 0,
      skusAtRiskCount: 0,
    },
  },
  filterOptions: {
    warehouses: [{ id: 'w-1', name: 'Main' }],
    suppliers: ['Cable Supplier', 'Legacy Supplier'],
  },
  coverage: {
    coldSalesPurgedExist: false,
    observedHistoryDays: 90,
    historyWindowDays: 90,
    earliestLiveSaleDate: '2026-06-01T00:00:00.000Z',
    unknownAgeOnHandCount: 1,
    warnings: ['1 SKU batch(es) lack purchaseDate and are grouped under unknown age.'],
  },
};

const mockDetails = {
  items: [
    {
      id: 'p-1',
      name: 'Patchcord 1m',
      nameKey: 'patchcord 1m',
      article: 'PC-1',
      serialNumber: 'S-1',
      price: 100,
      quantity: 4,
      reservedQuantity: 1,
      manualReservedQuantity: 0,
      orderReservedQuantity: 1,
      availableQuantity: 3,
      valuation: 400,
      availableValuation: 300,
      supplier: 'Cable Supplier',
      warehouseId: 'w-1',
      warehouseName: 'Main',
      locationId: 'l-1',
      locationName: 'A1',
      supplierOrderId: 'so-1',
      purchaseDate: '2026-10-20T00:00:00.000Z',
      ageDays: 22,
      ageBucket: '0-30' as const,
      stockState: 'in_stock' as const,
    },
    {
      id: 'p-2',
      name: 'Router',
      nameKey: 'router',
      article: '',
      serialNumber: '',
      price: 300,
      quantity: 2,
      reservedQuantity: 0,
      manualReservedQuantity: 0,
      orderReservedQuantity: 0,
      availableQuantity: 2,
      valuation: 600,
      availableValuation: 600,
      supplier: 'Legacy Supplier',
      warehouseId: 'w-2',
      warehouseName: 'Old',
      locationId: 'l-2',
      locationName: 'Archive',
      supplierOrderId: '',
      purchaseDate: null,
      ageDays: null,
      ageBucket: 'unknown' as const,
      stockState: 'low_stock' as const,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 25,
  totals: {
    totalQuantity: 6,
    reservedQuantity: 1,
    availableQuantity: 5,
    valuation: 1000,
  },
};

const { reportSpy } = vi.hoisted(() => ({
  reportSpy: vi.fn(),
}));

vi.mock('../../../../entities/analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../entities/analytics')>();
  return {
    ...actual,
    useWarehouseReportQuery: (params: unknown) => {
      reportSpy(params);
      return { data: mockWarehouseReport, isLoading: false, isError: false };
    },
    useWarehouseReportDetailsQuery: () => ({
      data: mockDetails,
      isLoading: false,
      isError: false,
    }),
    getWarehouseReportDetails: async () => mockDetails,
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
  reportSpy.mockReset();
});

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'Patchcord 1m',
  article: 'PC-1',
  serialNumber: 'S-1',
  price: 100,
  salePriceOptions: [],
  note: '',
  quantity: 4,
  reservedQuantity: 0,
  freeQuantity: 4,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'w-1',
  locationId: 'l-1',
  supplierOrderId: 'so-1',
  supplierOrderItemIndex: 0,
  purchaseDate: '2026-10-20T00:00:00.000Z',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
  ...overrides,
});

const warehouses: WarehouseItem[] = [
  {
    id: 'w-1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-1', name: 'A1' }],
  },
];

const supplierOrders: SupplierOrder[] = [];

const renderPanel = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <WarehouseInformationPanel
          products={[product()]}
          sales={[]}
          warehouses={warehouses}
          supplierOrders={supplierOrders}
        />
      </I18nextProvider>
    </QueryClientProvider>,
  );

describe('WarehouseInformationPanel', () => {
  it('renders KPI cards, aging buckets, demand suggestions, coverage warning, and stock drill-down', () => {
    renderPanel();

    expect(screen.getByText(i18n.t('warehouse.information.title'))).toBeTruthy();
    expect(screen.getAllByText(/Unknown age/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Patchcord 1m').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Router').length).toBeGreaterThan(0);
    expect(screen.getByText('sparse')).toBeTruthy();
    expect(
      screen.getByText(/lack purchaseDate and are grouped under unknown age/i),
    ).toBeTruthy();

    // Default leadTimeDays=14 & safetyStockDays=7 passed to query
    expect(reportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        leadTimeDays: 14,
        safetyStockDays: 7,
        horizonDays: 30,
      }),
    );

    // Clickable aging bucket updates filter
    fireEvent.click(screen.getByRole('button', { name: /Unknown age \(1 rows\)/i }));
    expect(reportSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ageBucket: 'unknown',
      }),
    );
  });

  it('renders Ukrainian copy when the interface language is uk', async () => {
    await i18n.changeLanguage('uk');
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Огляд складу' })).toBeTruthy();
    expect(screen.getByLabelText('Склад')).toBeTruthy();
    expect(screen.getByText('Усі склади')).toBeTruthy();
    expect(screen.getByLabelText('Локація')).toBeTruthy();
    expect(screen.getByText('Усі локації')).toBeTruthy();
    expect(screen.getByLabelText('Постачальник')).toBeTruthy();
    expect(screen.getByText('Усі постачальники')).toBeTruthy();
    expect(screen.getByLabelText('Стан залишку')).toBeTruthy();
    expect(screen.getByLabelText('Група давності')).toBeTruthy();
    expect(screen.getByLabelText('Пошук')).toBeTruthy();
    expect(screen.getByPlaceholderText('Назва, артикул, серійний...')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скинути фільтри' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Експорт Excel (.xlsx)' })).toBeTruthy();
    expect(screen.getByText('Загальна кількість на складі')).toBeTruthy();
    expect(screen.getByText('Доступно / зарезервовано')).toBeTruthy();
    expect(screen.getByText('Закупівельна вартість')).toBeTruthy();
    expect(screen.getByText('Немає / низький / невідомий термін')).toBeTruthy();
    expect(screen.getByText('Спостережуваний попит за 90 днів і дозамовлення')).toBeTruthy();
    expect(screen.getByText('Групи давності запасів')).toBeTruthy();
    expect(screen.getByText('Розподіл за постачальниками')).toBeTruthy();
    expect(screen.getByText('Розподіл за локаціями')).toBeTruthy();
    expect(screen.getByText('Прогноз запасів і пропозиції дозамовлення')).toBeTruthy();
    expect(screen.getByText('Деталізація складських записів')).toBeTruthy();
    expect(screen.getAllByText('Невідомий термін').length).toBeGreaterThan(0);
    expect(screen.getByText('рідкісний')).toBeTruthy();
    expect(screen.getByText('18 од.')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Невідомий термін \(1 рядок\)/ }),
    ).toBeTruthy();
    // Mock warning has no code and does not match a known backend English string
    expect(
      screen.getByText(/lack purchaseDate and are grouped under unknown age/i),
    ).toBeTruthy();
    // Scenario bar
    expect(screen.getByText('Сценарій оцінки')).toBeTruthy();
    expect(screen.getByText('Лише оцінка')).toBeTruthy();
    expect(screen.getByLabelText('Приватні збережені сценарії')).toBeTruthy();
    expect(screen.getByText('Зберегти новий')).toBeTruthy();
  });

  it('renders all 5 warehouse section headers as toggle buttons and supports independent collapse per employee', async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('en');

    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nextProvider i18n={i18n}>
          <WarehouseInformationPanel
            products={[product()]}
            sales={[]}
            warehouses={warehouses}
            supplierOrders={supplierOrders}
            currentEmployeeId="emp-wh-test"
          />
        </I18nextProvider>
      </QueryClientProvider>,
    );

    // All 5 section headers are toggle buttons
    const agingBtn = screen.getByRole('button', {
      name: /^Inventory Aging Buckets/i,
    });
    const supplierBtn = screen.getByRole('button', {
      name: /^Supplier Distribution/i,
    });
    const locationBtn = screen.getByRole('button', {
      name: /^Location Distribution/i,
    });
    const forecastBtn = screen.getByRole('button', {
      name: /^Inventory Forecasting & Reorder Suggestions/i,
    });
    const stockBtn = screen.getByRole('button', {
      name: /^Stock Records Drill-Down/i,
    });

    expect(agingBtn).toHaveAttribute('aria-expanded', 'true');
    expect(supplierBtn).toHaveAttribute('aria-expanded', 'true');
    expect(locationBtn).toHaveAttribute('aria-expanded', 'true');
    expect(forecastBtn).toHaveAttribute('aria-expanded', 'true');
    expect(stockBtn).toHaveAttribute('aria-expanded', 'true');

    // Collapse Aging Buckets
    fireEvent.click(agingBtn);
    expect(agingBtn).toHaveAttribute('aria-expanded', 'false');
    // Subtitle is hidden
    expect(
      screen.queryByText(/Click any bucket to filter stock details below/i),
    ).not.toBeInTheDocument();

    // Other 4 sections remain expanded
    expect(supplierBtn).toHaveAttribute('aria-expanded', 'true');
    expect(locationBtn).toHaveAttribute('aria-expanded', 'true');
    expect(forecastBtn).toHaveAttribute('aria-expanded', 'true');
    expect(stockBtn).toHaveAttribute('aria-expanded', 'true');

    // Collapse Forecast
    fireEvent.click(forecastBtn);
    expect(forecastBtn).toHaveAttribute('aria-expanded', 'false');
    expect(supplierBtn).toHaveAttribute('aria-expanded', 'true');

    // Verify localStorage has persisted both collapsed sections for this employee
    const rawStored = window.localStorage.getItem(
      'project-goods.analytics-collapsed-sections.emp-wh-test',
    );
    expect(JSON.parse(rawStored || '[]')).toEqual([
      'warehouse-aging-buckets',
      'warehouse-forecast-reorder',
    ]);
  });
});
