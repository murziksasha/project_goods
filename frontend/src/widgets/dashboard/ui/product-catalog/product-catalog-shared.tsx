import { useEffect } from 'react';
import type { ProductFormValues } from '../../../../entities/product/model/types';
import type { ServiceCatalogFormValues } from '../../../../entities/service-catalog/model/types';

export type CatalogTab = 'products' | 'catalogProducts' | 'services' | 'suppliers';
export type CatalogActivityFilter = 'all' | 'active' | 'inactive';
export type CatalogFilters = {
  query: string;
  note: string;
  status: CatalogActivityFilter;
  dateFrom: string;
  dateTo: string;
  priceFrom: string;
  priceTo: string;
};

export const catalogTabStorageKey = 'project-goods.catalog-tab';
export const catalogActiveFiltersStorageKey =
  'project-goods.catalog-active-filters';
export const catalogSavedFiltersStorageKey =
  'project-goods.catalog-saved-filters';

export const tabs: Array<{ key: CatalogTab; labelKey: string }> = [
  { key: 'products', labelKey: 'catalog.tabs.products' },
  { key: 'catalogProducts', labelKey: 'catalog.tabs.catalogProducts' },
  { key: 'services', labelKey: 'catalog.tabs.services' },
  { key: 'suppliers', labelKey: 'catalog.tabs.suppliers' },
];

export const emptyCatalogFilters: CatalogFilters = {
  query: '',
  note: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  priceFrom: '',
  priceTo: '',
};

export const normalizeCatalogFilters = (
  filters?: Partial<CatalogFilters>,
): CatalogFilters => ({
  ...emptyCatalogFilters,
  ...filters,
  query: filters?.query?.trim() ?? '',
  note: filters?.note?.trim() ?? '',
  status:
    filters?.status === 'active' || filters?.status === 'inactive'
      ? filters.status
      : 'all',
  dateFrom: filters?.dateFrom ?? '',
  dateTo: filters?.dateTo ?? '',
  priceFrom: filters?.priceFrom?.trim() ?? '',
  priceTo: filters?.priceTo?.trim() ?? '',
});

export const readCatalogActiveFilters = (): Record<CatalogTab, CatalogFilters> => {
  try {
    const raw = JSON.parse(
      window.localStorage.getItem(catalogActiveFiltersStorageKey) ?? '{}',
    ) as Partial<Record<CatalogTab, Partial<CatalogFilters>>>;

    return {
      products: normalizeCatalogFilters(raw.products),
      catalogProducts: normalizeCatalogFilters(raw.catalogProducts),
      services: normalizeCatalogFilters(raw.services),
      suppliers: normalizeCatalogFilters(raw.suppliers),
    };
  } catch {
    return {
      products: emptyCatalogFilters,
      catalogProducts: emptyCatalogFilters,
      services: emptyCatalogFilters,
      suppliers: emptyCatalogFilters,
    };
  }
};

export const getActiveCatalogFiltersCount = (filters: CatalogFilters) =>
  (filters.query ? 1 : 0) +
  (filters.note ? 1 : 0) +
  (filters.status !== 'all' ? 1 : 0) +
  (filters.dateFrom ? 1 : 0) +
  (filters.dateTo ? 1 : 0) +
  (filters.priceFrom ? 1 : 0) +
  (filters.priceTo ? 1 : 0);

export const isDateInCatalogRange = (
  value: string,
  dateFrom: string,
  dateTo: string,
) => {
  const isoDate = value.slice(0, 10);
  if (dateFrom && isoDate < dateFrom) return false;
  if (dateTo && isoDate > dateTo) return false;
  return true;
};

export const parseCatalogNumberFilter = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getPriceOption = (form: ProductFormValues, index: number) =>
  form.salePriceOptions
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[index] ?? '';

export const setPriceOption = (
  form: ProductFormValues,
  index: number,
  value: string,
) => {
  const values = form.salePriceOptions
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  values[index] = value;
  return values.join(', ');
};

export const getServicePriceOption = (
  form: ServiceCatalogFormValues,
  index: number,
) =>
  (form.salePriceOptions ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)[index] ?? '';

export const setServicePriceOption = (
  form: ServiceCatalogFormValues,
  index: number,
  value: string,
) => {
  const values = form.salePriceOptions
    ? form.salePriceOptions
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  values[index] = value;
  return values.join(', ');
};

export const useLockBodyScroll = () => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
};
