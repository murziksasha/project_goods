import { afterEach, describe, expect, it } from 'vitest';
import type { FinanceProfitReport } from '../../../entities/finance/model/types';
import {
  buildProfitReportFilename,
  defaultProfitReportFilters,
  getStoredProfitReportFilters,
  profitReportFiltersStorageKey,
  storeProfitReportFilters,
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
