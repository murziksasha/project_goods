import type { Product } from '../model/types';

export type ProductSalePriceTier = 'retail' | 'wholesale';

const roundPrice = (value: number) => Math.round(value * 100) / 100;

export const getRetailSalePrice = (product: Pick<Product, 'salePriceOptions' | 'price'>) =>
  roundPrice(product.salePriceOptions[0] ?? product.price ?? 0);

export const getWholesaleSalePrice = (product: Pick<Product, 'salePriceOptions'>) =>
  roundPrice(product.salePriceOptions[1] ?? 0);

export const hasWholesaleSalePrice = (product: Pick<Product, 'salePriceOptions'>) =>
  getWholesaleSalePrice(product) > 0;

export const getProductSalePriceByTier = (
  product: Pick<Product, 'salePriceOptions' | 'price'>,
  tier: ProductSalePriceTier,
) => (tier === 'wholesale' ? getWholesaleSalePrice(product) : getRetailSalePrice(product));

export const formatProductSalePrice = (price: number) => String(roundPrice(price));

export const matchesProductSalePriceTier = (
  product: Pick<Product, 'salePriceOptions' | 'price'>,
  value: string,
  tier: ProductSalePriceTier,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  return roundPrice(parsed) === getProductSalePriceByTier(product, tier);
};