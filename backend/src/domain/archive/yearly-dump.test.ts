import { describe, expect, it } from 'vitest';
import {
  buildSalesYearArchiveQuery,
  getSalesHotCutoff,
  listEligibleSalesArchiveYears,
  SALES_HOT_MONTHS,
} from './yearly-dump';

describe('yearly sales dump eligibility', () => {
  it('uses 24-month hot cutoff', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const cutoff = getSalesHotCutoff(now);
    const expected = new Date(now);
    expected.setMonth(expected.getMonth() - SALES_HOT_MONTHS);
    expect(cutoff.toISOString()).toBe(expected.toISOString());
  });

  it('lists only full years before hot cutoff year', () => {
    // Hot cutoff ~ 2024-07-28 → last full year 2023
    const years = listEligibleSalesArchiveYears(new Date('2026-07-28T12:00:00.000Z'));
    expect(years.at(-1)).toBe(2023);
    expect(years).not.toContain(2024);
    expect(years).not.toContain(2025);
  });

  it('builds terminal-status query for a year', () => {
    const query = buildSalesYearArchiveQuery(2022);
    expect(query.saleDate.$gte.toISOString()).toBe('2022-01-01T00:00:00.000Z');
    expect(query.saleDate.$lt.toISOString()).toBe('2023-01-01T00:00:00.000Z');
    expect(query.status.$in).toContain('paid');
  });
});
