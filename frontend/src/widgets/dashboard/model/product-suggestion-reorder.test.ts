import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../shared/api/queryClient';
import {
  compactProductReorderItems,
  mergeProductsWithLatestSortOrders,
  recordLatestSavedProductSortOrders,
  clearLatestSavedProductSortOrders,
  attachProductSortOrderRefetchOverlay,
  ProductSuggestionReorderCoordinator,
} from './product-suggestion-reorder';

describe('product-suggestion-reorder', () => {
  beforeEach(() => {
    clearLatestSavedProductSortOrders();
  });

  describe('compact numbering', () => {
    it('renumbers distinct names sequentially with no gap when repeated names exist', () => {
      // Repeat: upper row's number is kept, no gap left in sequence
      const items = ['Кабель', 'Оплата сервису ТВ', 'Кабель', 'Блок'];
      const result = compactProductReorderItems(items);

      expect(result).toEqual([
        { name: 'Кабель', sortOrder: 0 },
        { name: 'Оплата сервису ТВ', sortOrder: 1 },
        { name: 'Блок', sortOrder: 2 },
      ]);
    });

    it('matches names case-insensitively and trims whitespace', () => {
      // Case & trimming
      const items = [
        { name: '  Apple iPhone  ' },
        { name: 'apple iphone' },
        { name: 'APPLE IPHONE' },
        { name: 'Samsung Galaxy' },
      ];
      const result = compactProductReorderItems(items);

      expect(result).toEqual([
        { name: 'Apple iPhone', sortOrder: 0 },
        { name: 'Samsung Galaxy', sortOrder: 1 },
      ]);
    });

    it('ensures first row wins for casing and ordering', () => {
      // First row wins
      const items = [
        { name: 'Type-C Cable' },
        { name: 'HDMI Adapter' },
        { name: 'type-c cable' },
      ];
      const result = compactProductReorderItems(items);

      expect(result).toEqual([
        { name: 'Type-C Cable', sortOrder: 0 },
        { name: 'HDMI Adapter', sortOrder: 1 },
      ]);
    });

    it('assigns compact sequential numbers starting from 0 with no gaps', () => {
      // No gap
      const items = [
        'Item A',
        'Item B',
        'Item A',
        'Item C',
        'Item B',
        'Item D',
      ];
      const result = compactProductReorderItems(items);

      expect(result.map((item) => item.sortOrder)).toEqual([0, 1, 2, 3]);
      expect(result.map((item) => item.name)).toEqual([
        'Item A',
        'Item B',
        'Item C',
        'Item D',
      ]);
    });
  });

  describe('generation tracking', () => {
    it('ignores an earlier drop success when a later drop has already completed', async () => {
      const qc = new QueryClient();
      qc.setQueryData(queryKeys.catalogProducts, [
        { id: 'c1', name: 'Product A', sortOrder: 10 },
        { id: 'c2', name: 'Product B', sortOrder: 20 },
      ]);
      qc.setQueryData(queryKeys.products, [
        { id: 'p1', name: 'Product A', sortOrder: 10 },
        { id: 'p2', name: 'Product B', sortOrder: 20 },
      ]);

      let resolveDrop1: (value: { success: boolean; updatedCount: number }) => void;
      const drop1Promise = new Promise<{ success: boolean; updatedCount: number }>((resolve) => {
        resolveDrop1 = resolve;
      });

      const reorderApi = vi.fn((items: Array<{ name: string; sortOrder: number }>) => {
        if (items[0].name === 'Drop1') {
          return drop1Promise;
        }
        return Promise.resolve({ success: true, updatedCount: items.length });
      });

      const coordinator = new ProductSuggestionReorderCoordinator({
        queryClient: qc,
        reorderApi,
      });

      const rebuildSuccess1 = vi.fn();
      const rebuildSuccess2 = vi.fn();

      // Launch drop 1 (slow)
      const promise1 = coordinator.executeReorder({
        newSuggestions: [{ name: 'Drop1' }],
        query: 'test',
        rebuildSuccess: rebuildSuccess1,
      });

      // Launch drop 2 (fast)
      const promise2 = coordinator.executeReorder({
        newSuggestions: [{ name: 'Drop2' }],
        query: 'test',
        rebuildSuccess: rebuildSuccess2,
      });

      // Wait for drop 2 to succeed
      const result2 = await promise2;
      expect(result2).toBe(true);
      expect(rebuildSuccess2).toHaveBeenCalledTimes(1);

      // Now resolve drop 1
      resolveDrop1!({ success: true, updatedCount: 1 });
      const result1 = await promise1;

      // Earlier response must be ignored
      expect(result1).toBe(false);
      expect(rebuildSuccess1).not.toHaveBeenCalled();
    });

    it('ignores an earlier drop failure when a later drop has been started', async () => {
      const qc = new QueryClient();
      let rejectDrop1: (reason: Error) => void;
      const drop1Promise = new Promise<{ success: boolean; updatedCount: number }>((_, reject) => {
        rejectDrop1 = reject;
      });

      const reorderApi = vi.fn((items: Array<{ name: string; sortOrder: number }>) => {
        if (items[0].name === 'Drop1') {
          return drop1Promise;
        }
        return Promise.resolve({ success: true, updatedCount: items.length });
      });

      const coordinator = new ProductSuggestionReorderCoordinator({
        queryClient: qc,
        reorderApi,
      });

      const snapBackFailure1 = vi.fn();
      const onError1 = vi.fn();

      // Launch drop 1
      const promise1 = coordinator.executeReorder({
        newSuggestions: [{ name: 'Drop1' }],
        query: 'test',
        snapBackFailure: snapBackFailure1,
        onError: onError1,
      });

      // Launch drop 2
      await coordinator.executeReorder({
        newSuggestions: [{ name: 'Drop2' }],
        query: 'test',
      });

      // Now reject drop 1
      rejectDrop1!(new Error('Network error on drop 1'));
      const result1 = await promise1;

      expect(result1).toBe(false);
      expect(snapBackFailure1).not.toHaveBeenCalled();
      expect(onError1).not.toHaveBeenCalled();
    });
  });

  describe('refetch merge', () => {
    it('overlays old numbers with latest saved numbers when refetched data is stale', () => {
      const savedMap = new Map([
        ['кабель', 0],
        ['блок', 1],
      ]);

      const staleProducts = [
        { id: '1', name: 'Кабель', sortOrder: 5 },
        { id: '2', name: 'Шнур', sortOrder: 2 },
        { id: '3', name: 'Блок', sortOrder: 9 },
      ];

      const merged = mergeProductsWithLatestSortOrders(staleProducts, savedMap);

      expect(merged).toEqual([
        { id: '1', name: 'Кабель', sortOrder: 0 },
        { id: '2', name: 'Шнур', sortOrder: 2 },
        { id: '3', name: 'Блок', sortOrder: 1 },
      ]);
    });

    it('accepts matching numbers as-is and preserves array reference', () => {
      const savedMap = new Map([
        ['кабель', 0],
        ['блок', 1],
      ]);

      const matchingProducts = [
        { id: '1', name: 'Кабель', sortOrder: 0 },
        { id: '2', name: 'Шнур', sortOrder: 2 },
        { id: '3', name: 'Блок', sortOrder: 1 },
      ];

      const merged = mergeProductsWithLatestSortOrders(matchingProducts, savedMap);

      // Same numbers: must return original array reference
      expect(merged).toBe(matchingProducts);
    });

    it('overlays stale query data via QueryCache subscription and accepts matching data', () => {
      const qc = new QueryClient();
      attachProductSortOrderRefetchOverlay(qc);

      recordLatestSavedProductSortOrders([
        { name: 'Кабель', sortOrder: 0 },
        { name: 'Блок', sortOrder: 1 },
      ]);

      // Stale refetch lands
      qc.setQueryData(queryKeys.products, [
        { id: 'p1', name: 'Кабель', sortOrder: 5 },
        { id: 'p2', name: 'Блок', sortOrder: 9 },
        { id: 'p3', name: 'Адаптер', sortOrder: 3 },
      ]);

      const afterStale = qc.getQueryData<Array<{ name: string; sortOrder: number }>>(
        queryKeys.products,
      );
      expect(afterStale).toEqual([
        { id: 'p1', name: 'Кабель', sortOrder: 0 },
        { id: 'p2', name: 'Блок', sortOrder: 1 },
        { id: 'p3', name: 'Адаптер', sortOrder: 3 },
      ]);

      // Refetch with matching numbers lands
      qc.setQueryData(queryKeys.products, [
        { id: 'p1', name: 'Кабель', sortOrder: 0 },
        { id: 'p2', name: 'Блок', sortOrder: 1 },
        { id: 'p3', name: 'Адаптер', sortOrder: 3 },
      ]);

      const afterMatching = qc.getQueryData<Array<{ name: string; sortOrder: number }>>(
        queryKeys.products,
      );
      expect(afterMatching).toEqual([
        { id: 'p1', name: 'Кабель', sortOrder: 0 },
        { id: 'p2', name: 'Блок', sortOrder: 1 },
        { id: 'p3', name: 'Адаптер', sortOrder: 3 },
      ]);
    });
  });
});

