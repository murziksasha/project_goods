import { afterEach, describe, expect, it } from 'vitest';
import type {
  FinanceProfitReport,
  ProfitMarginRow,
} from '../../../entities/finance/model/types';
import {
  buildProfitChartRows,
  buildProfitMixShare,
  buildProfitReportFilename,
  defaultProfitReportFilters,
  defaultProfitReportVisualSettings,
  filterProfitMarginRows,
  getStoredProfitReportFilters,
  getStoredProfitReportVisualSettings,
  profitReportFiltersStorageKey,
  profitReportVisualStorageKey,
  resolveProfitReportCatalogTarget,
  storeProfitReportFilters,
  storeProfitReportVisualSettings,
  summarizeProfitMarginRows,
} from './profit-report';

const report = (patch: Partial<FinanceProfitReport> = {}): FinanceProfitReport => ({
  period: {
    key: 'day',
    dateFrom: '2026-09-15',
    dateTo: '2026-09-15',
    timeZone: 'Europe/Kiev',
  },
  source: 'all',
  currency: 'UAH',
  otherCurrencies: [],
  margin: {
    revenue: 100,
    cogs: 40,
    grossProfit: 60,
    grossMarginPct: 60,
    unknownCostCount: 0,
  },
  cash: {
    collected: 100,
    inventoryPurchases: 20,
    opex: 10,
    refunds: 0,
    net: 70,
    opexByCategory: [],
    operations: [],
  },
  rows: [],
  dataScope: 'live_sales_only',
  coldSalesPurgedExist: false,
  saleCount: 1,
  ...patch,
});

describe('profit report filters', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when storage is empty or invalid', () => {
    expect(getStoredProfitReportFilters()).toEqual(defaultProfitReportFilters());
    window.localStorage.setItem(profitReportFiltersStorageKey, '{bad');
    expect(getStoredProfitReportFilters()).toEqual(defaultProfitReportFilters());
  });

  it('persists and restores valid filters', () => {
    storeProfitReportFilters({
      period: 'week',
      source: 'services',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-07',
    });
    expect(getStoredProfitReportFilters()).toEqual({
      period: 'week',
      source: 'services',
      dateFrom: '2026-09-01',
      dateTo: '2026-09-07',
    });
  });

  it('builds an excel filename from the current report filters', () => {
    expect(buildProfitReportFilename(report())).toBe(
      'profit-report_all_2026-09-15_2026-09-15.xlsx',
    );
    expect(
      buildProfitReportFilename(
        report({
          source: 'sales',
          period: { key: 'whole', dateFrom: null, dateTo: null, timeZone: 'Europe/Kiev' },
        }),
      ),
    ).toBe('profit-report_sales_all-time_all-time.xlsx');
  });
});

const marginRow = (patch: Partial<ProfitMarginRow> = {}): ProfitMarginRow => ({
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
  ...patch,
});

describe('profit report visual settings', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns defaults when storage is empty or invalid', () => {
    expect(getStoredProfitReportVisualSettings()).toEqual(
      defaultProfitReportVisualSettings(),
    );
    window.localStorage.setItem(profitReportVisualStorageKey, '{bad');
    expect(getStoredProfitReportVisualSettings()).toEqual(
      defaultProfitReportVisualSettings(),
    );
  });

  it('persists and restores valid visual settings', () => {
    storeProfitReportVisualSettings({
      showCharts: false,
      chartMetric: 'quantity',
      highlightLosses: false,
      compactTable: true,
    });
    expect(getStoredProfitReportVisualSettings()).toEqual({
      showCharts: false,
      chartMetric: 'quantity',
      highlightLosses: false,
      compactTable: true,
    });
  });
});

describe('profit report row analysis', () => {
  const rows = [
    marginRow(),
    marginRow({
      key: 'product:p2',
      name: 'Screen',
      quantity: 2,
      cost: 80,
      revenue: 100,
      profit: 20,
      marginPct: 20,
      catalogProductId: null,
    }),
    marginRow({
      key: 'service:s1',
      name: 'Diagnostics',
      type: 'service',
      cost: 0,
      revenue: 200,
      profit: 200,
      marginPct: 100,
      catalogProductId: null,
      serviceId: 's1',
    }),
    marginRow({
      key: 'product:p3',
      name: 'Cable',
      cost: 50,
      revenue: 40,
      profit: -10,
      marginPct: -25,
      catalogProductId: null,
    }),
    marginRow({
      key: 'product:p4',
      name: 'Unknown part',
      cost: 0,
      revenue: 30,
      profit: 30,
      marginPct: null,
      costKnown: false,
      catalogProductId: null,
    }),
  ];

  it('filters by search, type, and margin band', () => {
    expect(
      filterProfitMarginRows(rows, {
        search: 'batt',
        type: 'all',
        margin: 'all',
        sort: 'default',
      }).map((row) => row.name),
    ).toEqual(['Battery']);
    expect(
      filterProfitMarginRows(rows, {
        search: '',
        type: 'service',
        margin: 'all',
        sort: 'default',
      }).map((row) => row.name),
    ).toEqual(['Diagnostics']);
    expect(
      filterProfitMarginRows(rows, {
        search: '',
        type: 'all',
        margin: 'loss',
        sort: 'default',
      }).map((row) => row.name),
    ).toEqual(['Cable']);
    expect(
      filterProfitMarginRows(rows, {
        search: '',
        type: 'all',
        margin: 'unknown',
        sort: 'default',
      }).map((row) => row.name),
    ).toEqual(['Unknown part']);
  });

  it('summarizes a selected group and leaves margin null when cost is unknown', () => {
    expect(summarizeProfitMarginRows([rows[0], rows[2]])).toMatchObject({
      count: 2,
      quantity: 2,
      revenue: 700,
      profit: 500,
      marginPct: 71.43,
      costKnown: true,
    });
    expect(summarizeProfitMarginRows([rows[4]]).marginPct).toBeNull();
    expect(summarizeProfitMarginRows([]).marginPct).toBeNull();
  });

  it('builds mix and top-item chart rows from the visible set', () => {
    const mix = buildProfitMixShare(rows, 'profit');
    expect(mix.product + mix.service).toBe(540);
    expect(mix.productPct).toBeGreaterThan(mix.servicePct);
    const chartRows = buildProfitChartRows(rows, 'profit', 3);
    expect(chartRows.map((row) => row.name)).toEqual([
      'Battery',
      'Diagnostics',
      'Unknown part',
    ]);
    expect(chartRows[0]?.sharePercent).toBeGreaterThan(
      chartRows[1]?.sharePercent ?? 0,
    );
  });

  it('opens the product model for goods names and the service catalog when matched', () => {
    const services = [
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
    ];
    expect(resolveProfitReportCatalogTarget(rows[0], services)).toEqual({
      kind: 'product',
      name: 'Battery',
    });
    expect(
      resolveProfitReportCatalogTarget(
        marginRow({ name: 'Screen', catalogProductId: null }),
        services,
      ),
    ).toEqual({ kind: 'product', name: 'Screen' });
    expect(
      resolveProfitReportCatalogTarget(rows[2], services)?.kind,
    ).toBe('service');
    expect(
      resolveProfitReportCatalogTarget(
        marginRow({
          key: 'service:unknown',
          name: 'Unknown service',
          type: 'service',
          catalogProductId: null,
          serviceId: null,
        }),
        services,
      ),
    ).toBeNull();
  });
});
