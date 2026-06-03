import { useEffect } from 'react';
import type { ProductFormValues } from '../../../entities/product/model/types';
import type { ServiceCatalogFormValues } from '../../../entities/service-catalog/model/types';

export type CatalogTab = 'products' | 'catalogProducts' | 'services' | 'suppliers';

export const catalogTabStorageKey = 'project-goods.catalog-tab';

export const tabs: Array<{ key: CatalogTab; label: string }> = [
  { key: 'products', label: 'Clients Device' },
  { key: 'catalogProducts', label: 'Products' },
  { key: 'services', label: 'Services' },
  { key: 'suppliers', label: 'Suppliers' },
];

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
