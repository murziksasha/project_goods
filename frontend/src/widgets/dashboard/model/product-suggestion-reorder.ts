import { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import {
  queryClient as defaultQueryClient,
  queryKeys,
} from '../../../shared/api/queryClient';
import type { CatalogProduct } from '../../../entities/catalog-product';
import { reorderProducts, type Product } from '../../../entities/product';

export interface ReorderProductItem {
  name: string;
  sortOrder: number;
}

export const normalizeProductNameForReorder = (name: string): string =>
  name.trim().toLowerCase();

export function compactProductReorderItems<T = { name: string } | string>(
  items: T[],
  getName?: (item: T) => string,
): ReorderProductItem[] {
  const resolveName = (item: T): string => {
    if (getName) return getName(item);
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      if ('name' in item && typeof (item as { name: unknown }).name === 'string') {
        return (item as { name: string }).name;
      }
      if ('type' in item) {
        const anyItem = item as {
          type?: string;
          catalogProduct?: { name?: string };
          product?: { name?: string };
        };
        if (anyItem.type === 'catalog' && anyItem.catalogProduct?.name) {
          return anyItem.catalogProduct.name;
        }
        if (anyItem.product?.name) {
          return anyItem.product.name;
        }
      }
    }
    return '';
  };

  const seen = new Map<string, number>();
  const compacted: ReorderProductItem[] = [];
  let nextOrder = 0;

  for (const item of items) {
    const raw = resolveName(item).trim();
    if (!raw) continue;
    const key = normalizeProductNameForReorder(raw);
    if (!seen.has(key)) {
      seen.set(key, nextOrder);
      compacted.push({ name: raw, sortOrder: nextOrder });
      nextOrder++;
    }
  }

  return compacted;
}

export function buildCompactSortOrderMap(
  items: ReorderProductItem[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(normalizeProductNameForReorder(item.name), item.sortOrder);
  }
  return map;
}

export function mergeProductsWithLatestSortOrders<
  T extends { name: string; sortOrder?: number },
>(
  products: T[],
  latestSavedNumbers: Map<string, number> | Record<string, number>,
): T[] {
  const getExpectedOrder = (name: string): number | undefined => {
    const key = normalizeProductNameForReorder(name);
    if (latestSavedNumbers instanceof Map) {
      return latestSavedNumbers.get(key);
    }
    return latestSavedNumbers[key];
  };

  let hasChanges = false;
  const merged = products.map((product) => {
    const expected = getExpectedOrder(product.name);
    if (expected !== undefined && product.sortOrder !== expected) {
      hasChanges = true;
      return {
        ...product,
        sortOrder: expected,
      };
    }
    return product;
  });

  return hasChanges ? merged : products;
}

const latestSavedProductSortOrders = new Map<string, number>();

export const getLatestSavedProductSortOrders = (): Map<string, number> =>
  new Map(latestSavedProductSortOrders);

export const recordLatestSavedProductSortOrders = (
  items: Array<{ name: string; sortOrder: number }>,
): void => {
  for (const item of items) {
    latestSavedProductSortOrders.set(
      normalizeProductNameForReorder(item.name),
      item.sortOrder,
    );
  }
};

export const clearLatestSavedProductSortOrders = (): void => {
  latestSavedProductSortOrders.clear();
};

const attachedQueryClients = new WeakSet<QueryClient>();

export function attachProductSortOrderRefetchOverlay(
  qc: QueryClient,
): () => void {
  if (attachedQueryClients.has(qc)) {
    return () => {};
  }
  attachedQueryClients.add(qc);

  let isUpdating = false;
  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (isUpdating) return;
    if (event.type === 'updated' && event.action?.type === 'success') {
      const queryKey = event.query.queryKey;
      const isProducts =
        queryKey.length === 1 && queryKey[0] === queryKeys.products[0];
      const isCatalog =
        queryKey.length === 1 && queryKey[0] === queryKeys.catalogProducts[0];

      if (!isProducts && !isCatalog) return;

      const data = event.query.state.data;
      if (!Array.isArray(data) || latestSavedProductSortOrders.size === 0) return;

      const merged = mergeProductsWithLatestSortOrders(
        data as Array<{ name: string; sortOrder?: number }>,
        latestSavedProductSortOrders,
      );

      if (merged !== data) {
        isUpdating = true;
        qc.setQueryData(queryKey, merged);
        isUpdating = false;
      }
    }
  });

  return () => {
    attachedQueryClients.delete(qc);
    unsubscribe();
  };
}

// Attach overlay to default singleton query client
attachProductSortOrderRefetchOverlay(defaultQueryClient);

export interface ExecuteProductReorderParams<T> {
  newSuggestions: T[];
  query: string;
  getName?: (item: T) => string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
  rebuildSuccess?: (savedNumbers: Map<string, number>) => void;
  snapBackFailure?: () => void;
}

export class ProductSuggestionReorderCoordinator {
  private currentGeneration = 0;
  private inFlightGeneration: number | null = null;
  private inFlightQuery: string | null = null;
  private queryClient: QueryClient;
  private reorderApi: (
    items: ReorderProductItem[],
  ) => Promise<{ success: boolean; updatedCount: number }>;

  constructor(options?: {
    queryClient?: QueryClient;
    reorderApi?: (
      items: ReorderProductItem[],
    ) => Promise<{ success: boolean; updatedCount: number }>;
  }) {
    this.queryClient = options?.queryClient ?? defaultQueryClient;
    this.reorderApi = options?.reorderApi ?? reorderProducts;
    if (options?.queryClient) {
      attachProductSortOrderRefetchOverlay(options.queryClient);
    }
  }

  getCurrentGeneration(): number {
    return this.currentGeneration;
  }

  getInFlightGeneration(): number | null {
    return this.inFlightGeneration;
  }

  getInFlightQuery(): string | null {
    return this.inFlightQuery;
  }

  hasUnsavedDrop(query: string): boolean {
    return (
      this.inFlightGeneration !== null &&
      this.inFlightQuery !== null &&
      normalizeProductNameForReorder(this.inFlightQuery) ===
        normalizeProductNameForReorder(query)
    );
  }

  async executeReorder<T>({
    newSuggestions,
    query,
    getName,
    onSuccess,
    onError,
    rebuildSuccess,
    snapBackFailure,
  }: ExecuteProductReorderParams<T>): Promise<boolean> {
    const generation = ++this.currentGeneration;
    this.inFlightGeneration = generation;
    this.inFlightQuery = query;

    const compactedItems = compactProductReorderItems(newSuggestions, getName);
    const savedMap = buildCompactSortOrderMap(compactedItems);

    try {
      if (compactedItems.length > 0) {
        await this.reorderApi(compactedItems);
      }

      if (this.currentGeneration !== generation) {
        return false;
      }

      this.inFlightGeneration = null;
      this.inFlightQuery = null;

      if (compactedItems.length > 0) {
        recordLatestSavedProductSortOrders(compactedItems);

        this.queryClient.setQueryData<CatalogProduct[]>(
          queryKeys.catalogProducts,
          (prev) =>
            prev
              ? mergeProductsWithLatestSortOrders(
                  prev,
                  latestSavedProductSortOrders,
                )
              : prev,
        );
        this.queryClient.setQueryData<Product[]>(
          queryKeys.products,
          (prev) =>
            prev
              ? mergeProductsWithLatestSortOrders(
                  prev,
                  latestSavedProductSortOrders,
                )
              : prev,
        );
      }

      rebuildSuccess?.(savedMap);
      onSuccess?.();
      return true;
    } catch (error) {
      if (this.currentGeneration !== generation) {
        return false;
      }

      this.inFlightGeneration = null;
      this.inFlightQuery = null;

      snapBackFailure?.();
      onError?.(error);
      return false;
    }
  }
}

export function useProductSuggestionReorder(options?: {
  queryClient?: QueryClient;
  reorderApi?: (
    items: ReorderProductItem[],
  ) => Promise<{ success: boolean; updatedCount: number }>;
}): ProductSuggestionReorderCoordinator {
  const qc = options?.queryClient ?? defaultQueryClient;
  const [coordinator] = useState(
    () =>
      new ProductSuggestionReorderCoordinator({
        queryClient: qc,
        reorderApi: options?.reorderApi,
      }),
  );
  return coordinator;
}
