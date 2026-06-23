import { describe, expect, it } from 'vitest';
import {
  formatAnalyticsDateRangeLabel,
  getAnalyticsDateRangeFilterCount,
  isSaleInAnalyticsDateRange,
  normalizeAnalyticsDateRange,
} from './analytics-date-range';

describe('analytics-date-range', () => {
  it('validates and normalizes date ranges', () => {
    expect(normalizeAnalyticsDateRange({ dateFrom: '2026-06-01', dateTo: '2026-06-10' })).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-10',
    });
    expect(normalizeAnalyticsDateRange({ dateFrom: '2026-06-10', dateTo: '2026-06-01' })).toBeNull();
    expect(normalizeAnalyticsDateRange({ dateFrom: '', dateTo: '' })).toBeNull();
  });

  it('counts active date filters', () => {
    expect(getAnalyticsDateRangeFilterCount(null)).toBe(0);
    expect(getAnalyticsDateRangeFilterCount({ dateFrom: '2026-06-01', dateTo: '' })).toBe(1);
    expect(getAnalyticsDateRangeFilterCount({ dateFrom: '2026-06-01', dateTo: '2026-06-02' })).toBe(2);
  });

  it('filters sales by date range', () => {
    expect(
      isSaleInAnalyticsDateRange('2026-06-05T10:00:00.000Z', {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
      }),
    ).toBe(true);
    expect(
      isSaleInAnalyticsDateRange('2026-05-31T10:00:00.000Z', {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
      }),
    ).toBe(false);
  });

  it('formats date range labels', () => {
    const label = formatAnalyticsDateRangeLabel({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-10',
    });
    expect(label).toContain('2026');
  });
});