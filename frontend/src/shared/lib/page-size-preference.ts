import { useCallback, useState } from 'react';

export const PAGE_SIZE_STORAGE_KEY = 'project-goods.page-sizes';

export const ALLOWED_PAGE_SIZES = [10, 30, 50, 100, 200] as const;
export type AllowedPageSize = (typeof ALLOWED_PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: AllowedPageSize = 30;

export type PageSizeListKey =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'warehouse'
  | 'warehouseInformationProducts'
  | 'warehouseInformationLocations'
  | 'warehouseInformationSuppliers'
  | 'clients'
  | 'clientSuppliers'
  | 'catalogProducts'
  | 'catalogCatalogProducts'
  | 'catalogServices'
  | 'catalogSuppliers'
  | 'accountingTransactions'
  | 'accountingReports'
  | 'settingsBackups';

export type PageSizeSeed = number | (() => number | undefined | null) | undefined | null;

export const isAllowedPageSize = (value: unknown): value is AllowedPageSize => {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (ALLOWED_PAGE_SIZES as readonly number[]).includes(value)
  );
};

const resolveSeed = (seed?: PageSizeSeed): number | undefined => {
  if (typeof seed === 'function') {
    try {
      const result = seed();
      return typeof result === 'number' ? result : undefined;
    } catch {
      return undefined;
    }
  }
  return typeof seed === 'number' ? seed : undefined;
};

const readStorageMap = (): Record<string, unknown> => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

const writeStorageMap = (map: Record<string, unknown>): void => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Read/write failures are ignored.
  }
};

export const readStoredPageSize = (
  listId: PageSizeListKey | string,
  seed?: PageSizeSeed,
): AllowedPageSize => {
  const map = readStorageMap();
  const existing = map[listId];

  if (isAllowedPageSize(existing)) {
    return existing;
  }

  const seedValue = resolveSeed(seed);
  if (isAllowedPageSize(seedValue)) {
    map[listId] = seedValue;
    writeStorageMap(map);
    return seedValue;
  }

  return DEFAULT_PAGE_SIZE;
};

export const writeStoredPageSize = (
  listId: PageSizeListKey | string,
  value: unknown,
): void => {
  if (!isAllowedPageSize(value)) {
    return;
  }

  const map = readStorageMap();
  map[listId] = value;
  writeStorageMap(map);
};

export const useStoredPageSize = (
  listId: PageSizeListKey | string,
  seed?: PageSizeSeed,
): [AllowedPageSize, (nextPageSize: number) => void] => {
  const [pageSize, setPageSizeState] = useState<AllowedPageSize>(() =>
    readStoredPageSize(listId, seed),
  );

  const setPageSize = useCallback(
    (nextPageSize: number) => {
      if (isAllowedPageSize(nextPageSize)) {
        writeStoredPageSize(listId, nextPageSize);
        setPageSizeState(nextPageSize);
      } else {
        setPageSizeState(DEFAULT_PAGE_SIZE);
      }
    },
    [listId],
  );

  return [pageSize, setPageSize];
};

