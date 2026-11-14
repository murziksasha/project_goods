import { afterEach, describe, expect, it } from 'vitest';
import {
  clearStoredOrdersReportSettings,
  defaultColumnsForKind,
  defaultOrdersReportSettings,
  getStoredOrdersReportSettings,
  ordersReportsSettingsStorageKey,
  sanitizeColumns,
  storeOrdersReportSettings,
} from './orders-reports-settings';

afterEach(() => {
  window.localStorage.removeItem(ordersReportsSettingsStorageKey);
});

describe('orders report settings', () => {
  it('keeps finance columns out of the default set even when finance.view is available', () => {
    const withFinance = defaultColumnsForKind('repairs', true);
    const without = defaultColumnsForKind('repairs', false);
    expect(withFinance).toEqual(without);
    expect(withFinance).not.toContain('knownCost');
    expect(withFinance).not.toContain('knownProfit');
    expect(withFinance).toContain('recordNumber');
    expect(withFinance).toContain('total');
  });

  it('strips finance columns when the user cannot view finance and falls back to defaults if empty', () => {
    expect(sanitizeColumns('repairs', ['recordNumber', 'knownCost', 'total'], false)).toEqual([
      'recordNumber',
      'total',
    ]);
    expect(sanitizeColumns('repairs', ['knownCost'], false)).toEqual(
      defaultColumnsForKind('repairs', false),
    );
    expect(sanitizeColumns('repairs', ['recordNumber', 'knownCost'], true)).toEqual([
      'recordNumber',
      'knownCost',
    ]);
  });

  it('round-trips last-used settings and clearStored restores defaults', () => {
    const stored = {
      ...defaultOrdersReportSettings(false),
      kind: 'sales' as const,
      period: 'last7' as const,
      mode: 'summary' as const,
    };
    storeOrdersReportSettings(stored);
    const raw = window.localStorage.getItem(ordersReportsSettingsStorageKey);
    expect(raw).toContain('sales');
    expect(getStoredOrdersReportSettings(false).kind).toBe('sales');
    expect(getStoredOrdersReportSettings(false).period).toBe('last7');
    clearStoredOrdersReportSettings();
    expect(window.localStorage.getItem(ordersReportsSettingsStorageKey)).toBeNull();
    expect(getStoredOrdersReportSettings(false).kind).toBe('repairs');
    expect(getStoredOrdersReportSettings(false).period).toBe('last30');
  });
});
