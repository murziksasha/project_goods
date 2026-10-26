import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PAGE_SIZE_STORAGE_KEY,
  readStoredPageSize,
  useStoredPageSize,
  writeStoredPageSize,
} from './page-size-preference';

describe('page-size-preference', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns 30 when key is missing and no valid seed is provided', () => {
    expect(readStoredPageSize('orders')).toBe(30);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();
  });

  it('round-trips 50 correctly', () => {
    writeStoredPageSize('orders', 50);
    expect(readStoredPageSize('orders')).toBe(50);
    expect(
      JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
    ).toEqual({ orders: 50 });
  });

  it('ignores 75, 0, and non-numeric values (returns 30 and does not write)', () => {
    writeStoredPageSize('orders', 75);
    expect(readStoredPageSize('orders')).toBe(30);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();

    writeStoredPageSize('orders', 0);
    expect(readStoredPageSize('orders')).toBe(30);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();

    writeStoredPageSize('orders', '50' as unknown as number);
    expect(readStoredPageSize('orders')).toBe(30);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();

    // If localStorage already had broken value for that key, it is ignored and returns 30
    window.localStorage.setItem(
      PAGE_SIZE_STORAGE_KEY,
      JSON.stringify({ orders: 75, sales: 'invalid' }),
    );
    expect(readStoredPageSize('orders')).toBe(30);
    expect(readStoredPageSize('sales')).toBe(30);
  });

  it('does not allow orders and sales to overwrite each other', () => {
    writeStoredPageSize('orders', 50);
    writeStoredPageSize('sales', 100);

    expect(readStoredPageSize('orders')).toBe(50);
    expect(readStoredPageSize('sales')).toBe(100);
    expect(
      JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
    ).toEqual({
      orders: 50,
      sales: 100,
    });
  });

  it('prefers device value 100 over seed 50', () => {
    writeStoredPageSize('warehouse', 100);
    expect(readStoredPageSize('warehouse', 50)).toBe(100);
    expect(
      JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
    ).toEqual({ warehouse: 100 });
  });

  it('copies seed 50 once when missing device entry, and second read does not need seed', () => {
    const firstRead = readStoredPageSize('warehouse', 50);
    expect(firstRead).toBe(50);
    expect(
      JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
    ).toEqual({ warehouse: 50 });

    const secondRead = readStoredPageSize('warehouse');
    expect(secondRead).toBe(50);
  });

  it('evaluates seed callback only when entry is missing and ignores invalid seed', () => {
    let callCount = 0;
    const seedCallback = () => {
      callCount += 1;
      return 50;
    };

    expect(readStoredPageSize('clients', seedCallback)).toBe(50);
    expect(callCount).toBe(1);

    // Second read does not call seed callback because entry now exists
    expect(readStoredPageSize('clients', seedCallback)).toBe(50);
    expect(callCount).toBe(1);

    // Invalid seed is ignored and not written
    window.localStorage.clear();
    expect(readStoredPageSize('clients', 75)).toBe(30);
    expect(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY)).toBeNull();
  });

  it('handles broken JSON map in localStorage gracefully', () => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, '{invalid json');
    expect(readStoredPageSize('orders')).toBe(30);

    writeStoredPageSize('orders', 50);
    expect(readStoredPageSize('orders')).toBe(50);
    expect(
      JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
    ).toEqual({ orders: 50 });
  });

  describe('useStoredPageSize hook', () => {
    it('initializes from storage and allows updating', () => {
      const { result } = renderHook(() => useStoredPageSize('orders'));
      expect(result.current[0]).toBe(30);

      act(() => {
        result.current[1](50);
      });

      expect(result.current[0]).toBe(50);
      expect(readStoredPageSize('orders')).toBe(50);
    });

    it('falls back to 30 and does not write when setter receives invalid option', () => {
      writeStoredPageSize('orders', 50);
      const { result } = renderHook(() => useStoredPageSize('orders'));
      expect(result.current[0]).toBe(50);

      act(() => {
        result.current[1](75);
      });

      expect(result.current[0]).toBe(30);
      // Storage should still have the previously written valid value (or unmodified)
      expect(
        JSON.parse(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY) || '{}'),
      ).toEqual({ orders: 50 });
    });
  });
});

