import { describe, expect, it } from 'vitest';
import {
  getStatusFilterBadgeCount,
  getStatusFilterSummaryKey,
  isAllStatusesSelected,
  matchesStatusFilter,
  resolveStatusSelectionWithLegacyFallback,
  toggleAllStatuses,
  toggleSingleStatus,
} from './status-selection';

describe('status-selection helpers', () => {
  const options = ['a', 'b', 'c'] as const;

  it('determines if all statuses are selected', () => {
    expect(isAllStatusesSelected(['a', 'b', 'c'], options)).toBe(true);
    expect(isAllStatusesSelected(['a', 'b'], options)).toBe(false);
    expect(isAllStatusesSelected([], options)).toBe(false);
  });

  it('toggles a single status, completes set, and turns all off on release', () => {
    // Start with empty, toggle 'a'
    const step1 = toggleSingleStatus([], 'a');
    expect(step1).toEqual(['a']);
    expect(isAllStatusesSelected(step1, options)).toBe(false);

    // Toggle 'b'
    const step2 = toggleSingleStatus(step1, 'b');
    expect(step2).toEqual(['a', 'b']);
    expect(isAllStatusesSelected(step2, options)).toBe(false);

    // Toggle 'c' -> completes the set
    const step3 = toggleSingleStatus(step2, 'c');
    expect(step3).toEqual(['a', 'b', 'c']);
    expect(isAllStatusesSelected(step3, options)).toBe(true);

    // Releasing one turns All off
    const step4 = toggleSingleStatus(step3, 'b');
    expect(step4).toEqual(['a', 'c']);
    expect(isAllStatusesSelected(step4, options)).toBe(false);
  });

  it('toggles all statuses: clears when all on, fills when any off', () => {
    // When all are on -> clicking all clears to none
    expect(toggleAllStatuses(['a', 'b', 'c'], options)).toEqual([]);

    // When none are on -> clicking all fills to every status
    expect(toggleAllStatuses([], options)).toEqual(['a', 'b', 'c']);

    // When some are on -> clicking all fills to every status
    expect(toggleAllStatuses(['a'], options)).toEqual(['a', 'b', 'c']);
  });

  it('matches status filter and treats empty list as matching nothing', () => {
    expect(matchesStatusFilter('a', ['a', 'b'])).toBe(true);
    expect(matchesStatusFilter('c', ['a', 'b'])).toBe(false);
    expect(matchesStatusFilter('a', [])).toBe(false);
  });

  it('computes summary key for panel summary', () => {
    expect(getStatusFilterSummaryKey(['a', 'b', 'c'], options)).toBe('all');
    expect(getStatusFilterSummaryKey([], options)).toBe('none');
    expect(getStatusFilterSummaryKey(['a'], options)).toBe('count');
    expect(getStatusFilterSummaryKey(['a', 'b'], options)).toBe('count');
  });

  it('computes badge count for single and per-status modes', () => {
    // Single mode (Receipts): all = 0, none = 1, subset = 1
    expect(getStatusFilterBadgeCount(['a', 'b', 'c'], options, 'single')).toBe(0);
    expect(getStatusFilterBadgeCount([], options, 'single')).toBe(1);
    expect(getStatusFilterBadgeCount(['a'], options, 'single')).toBe(1);
    expect(getStatusFilterBadgeCount(['a', 'b'], options, 'single')).toBe(1);

    // Per-status mode (Supplier Order): all = 0, none = 1, subset = selected.length
    expect(getStatusFilterBadgeCount(['a', 'b', 'c'], options, 'per-status')).toBe(0);
    expect(getStatusFilterBadgeCount([], options, 'per-status')).toBe(1);
    expect(getStatusFilterBadgeCount(['a'], options, 'per-status')).toBe(1);
    expect(getStatusFilterBadgeCount(['a', 'b'], options, 'per-status')).toBe(2);
  });

  it('resolves explicit empty selection as empty list', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      statuses: [],
      statusSelectionExplicit: true,
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: [],
      statusSelectionExplicit: true,
    });
  });

  it('resolves explicit non-empty selection filtering invalid values', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      statuses: ['a', 'invalid'],
      statusSelectionExplicit: true,
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: ['a'],
      statusSelectionExplicit: true,
    });
  });

  it('falls back legacy empty array to full options list', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      statuses: [],
      statusSelectionExplicit: false,
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: ['a', 'b', 'c'],
      statusSelectionExplicit: true,
    });
  });

  it('falls back legacy missing/undefined to full options list', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      statuses: undefined,
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: ['a', 'b', 'c'],
      statusSelectionExplicit: true,
    });
  });

  it('preserves legacy non-empty array and marks explicit', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      statuses: ['b'],
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: ['b'],
      statusSelectionExplicit: true,
    });
  });

  it('handles legacy single status field', () => {
    const result = resolveStatusSelectionWithLegacyFallback({
      legacySingleStatus: 'c',
      allOptions: options,
    });
    expect(result).toEqual({
      statuses: ['c'],
      statusSelectionExplicit: true,
    });

    const resultAll = resolveStatusSelectionWithLegacyFallback({
      legacySingleStatus: 'all',
      allOptions: options,
    });
    expect(resultAll).toEqual({
      statuses: ['a', 'b', 'c'],
      statusSelectionExplicit: true,
    });
  });
});
