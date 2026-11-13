import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX,
  getAnalyticsCollapsedSectionsStorageKey,
  readStoredCollapsedSections,
  useAnalyticsCollapsedSections,
  writeStoredCollapsedSections,
} from './analytics-collapsed-sections';

describe('analytics-collapsed-sections preference-hook', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('generates consistent storage keys scoped by employee ID', () => {
    expect(getAnalyticsCollapsedSectionsStorageKey('emp-101')).toBe(
      `${ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX}.emp-101`,
    );
    expect(getAnalyticsCollapsedSectionsStorageKey(null)).toBe(
      `${ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX}.anonymous`,
    );
    expect(getAnalyticsCollapsedSectionsStorageKey('')).toBe(
      `${ANALYTICS_COLLAPSED_SECTIONS_STORAGE_PREFIX}.anonymous`,
    );
  });

  it('expanded-by-default: returns empty array and all sections expanded initially', () => {
    const { result } = renderHook(() => useAnalyticsCollapsedSections('emp-1'));

    expect(result.current.collapsedSections).toEqual([]);
    expect(result.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(false);
    expect(result.current.isSectionCollapsed('warehouse-aging-buckets')).toBe(false);
  });

  it('сохранение после remount/reload: toggled state persists in localStorage across unmounts', () => {
    const { result, unmount } = renderHook(() =>
      useAnalyticsCollapsedSections('emp-1'),
    );

    act(() => {
      result.current.setSectionCollapsed('orders-repairs-open-aging-buckets', true);
    });

    expect(result.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(true);

    const storedRaw = window.localStorage.getItem(
      getAnalyticsCollapsedSectionsStorageKey('emp-1'),
    );
    expect(JSON.parse(storedRaw || '[]')).toEqual([
      'orders-repairs-open-aging-buckets',
    ]);

    unmount();

    // Remount to simulate reload
    const { result: remounted } = renderHook(() =>
      useAnalyticsCollapsedSections('emp-1'),
    );

    expect(
      remounted.current.isSectionCollapsed('orders-repairs-open-aging-buckets'),
    ).toBe(true);
    expect(remounted.current.collapsedSections).toEqual([
      'orders-repairs-open-aging-buckets',
    ]);
  });

  it('независимые секции: collapsing one section does not affect others', () => {
    const { result } = renderHook(() => useAnalyticsCollapsedSections('emp-1'));

    act(() => {
      result.current.toggleSectionCollapse('orders-repairs-open-aging-buckets');
    });

    expect(result.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(true);
    expect(result.current.isSectionCollapsed('orders-repairs-workload-by-status')).toBe(false);
    expect(result.current.isSectionCollapsed('warehouse-forecast-reorder')).toBe(false);

    act(() => {
      result.current.toggleSectionCollapse('warehouse-forecast-reorder');
    });

    expect(result.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(true);
    expect(result.current.isSectionCollapsed('warehouse-forecast-reorder')).toBe(true);

    act(() => {
      result.current.setSectionCollapsed('orders-repairs-open-aging-buckets', false);
    });

    expect(result.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(false);
    expect(result.current.isSectionCollapsed('warehouse-forecast-reorder')).toBe(true);
  });

  it('изоляция сотрудников: preferences are completely separated per employee', () => {
    const { result: emp1Hook } = renderHook(() =>
      useAnalyticsCollapsedSections('emp-1'),
    );

    act(() => {
      emp1Hook.current.setSectionCollapsed('orders-sales-revenue-trend', true);
    });

    const { result: emp2Hook } = renderHook(() =>
      useAnalyticsCollapsedSections('emp-2'),
    );

    expect(emp1Hook.current.isSectionCollapsed('orders-sales-revenue-trend')).toBe(true);
    expect(emp2Hook.current.isSectionCollapsed('orders-sales-revenue-trend')).toBe(false);

    act(() => {
      emp2Hook.current.setSectionCollapsed('warehouse-supplier-distribution', true);
    });

    expect(emp1Hook.current.isSectionCollapsed('warehouse-supplier-distribution')).toBe(false);
    expect(emp2Hook.current.isSectionCollapsed('warehouse-supplier-distribution')).toBe(true);

    // Dynamic employeeId prop change on same hook instance
    let activeEmp = 'emp-1';
    const { result: switchingHook, rerender } = renderHook(() =>
      useAnalyticsCollapsedSections(activeEmp),
    );

    expect(switchingHook.current.isSectionCollapsed('orders-sales-revenue-trend')).toBe(true);
    expect(switchingHook.current.isSectionCollapsed('warehouse-supplier-distribution')).toBe(false);

    activeEmp = 'emp-2';
    rerender();

    expect(switchingHook.current.isSectionCollapsed('orders-sales-revenue-trend')).toBe(false);
    expect(switchingHook.current.isSectionCollapsed('warehouse-supplier-distribution')).toBe(true);
  });

  it('восстановление после повреждённого localStorage: handles invalid JSON, null, and non-array payloads gracefully', () => {
    const key = getAnalyticsCollapsedSectionsStorageKey('emp-corrupt');

    // Case 1: Syntax error
    window.localStorage.setItem(key, '{{{ broken json');
    expect(readStoredCollapsedSections('emp-corrupt')).toEqual([]);

    const { result: hookCorrupt } = renderHook(() =>
      useAnalyticsCollapsedSections('emp-corrupt'),
    );
    expect(hookCorrupt.current.collapsedSections).toEqual([]);
    expect(hookCorrupt.current.isSectionCollapsed('orders-repairs-open-aging-buckets')).toBe(false);

    // Case 2: Primitive number instead of array
    window.localStorage.setItem(key, '12345');
    expect(readStoredCollapsedSections('emp-corrupt')).toEqual([]);

    // Case 3: Object instead of array
    window.localStorage.setItem(key, JSON.stringify({ key: 'val' }));
    expect(readStoredCollapsedSections('emp-corrupt')).toEqual([]);

    // Case 4: Array with non-string elements
    window.localStorage.setItem(
      key,
      JSON.stringify(['valid-sec', 123, null, { notString: true }]),
    );
    expect(readStoredCollapsedSections('emp-corrupt')).toEqual(['valid-sec']);

    // Can still write cleanly and recover storage
    writeStoredCollapsedSections('emp-corrupt', ['valid-sec', 'recovered-sec']);
    expect(readStoredCollapsedSections('emp-corrupt')).toEqual([
      'valid-sec',
      'recovered-sec',
    ]);
  });
});
