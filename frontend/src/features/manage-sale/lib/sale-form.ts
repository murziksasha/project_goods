import type { Product } from '../../../entities/product/model/types';
import { getRetailSalePrice } from '../../../entities/product/lib/sale-prices';

export const DEBOUNCE_MS = 300;
export const MAX_SUGGESTIONS = 6;

export const normalizeText = (value: string) => value.trim().toLowerCase();
export const normalizeDigits = (value: string) => value.replace(/\D/g, '');

export const getProductLabel = (product: Product) =>
  `${product.name} • ${product.article} • ${product.serialNumber}`;

export const getDefaultSalePrice = (product: Product) => getRetailSalePrice(product);
