import { describe, expect, it } from 'vitest';
import {
  getProductSalePriceByTier,
  getRetailSalePrice,
  getWholesaleSalePrice,
  hasWholesaleSalePrice,
  matchesProductSalePriceTier,
} from './sale-prices';

const product = {
  price: 100,
  salePriceOptions: [1000, 800],
};

describe('sale-prices', () => {
  it('resolves retail and wholesale prices from salePriceOptions', () => {
    expect(getRetailSalePrice(product)).toBe(1000);
    expect(getWholesaleSalePrice(product)).toBe(800);
    expect(hasWholesaleSalePrice(product)).toBe(true);
    expect(getProductSalePriceByTier(product, 'retail')).toBe(1000);
    expect(getProductSalePriceByTier(product, 'wholesale')).toBe(800);
  });

  it('falls back retail price to product.price when salePriceOptions[0] is missing', () => {
    expect(getRetailSalePrice({ price: 250, salePriceOptions: [] })).toBe(250);
  });

  it('falls back retail price to product.price when salePriceOptions[0] is zero', () => {
    expect(getRetailSalePrice({ price: 250, salePriceOptions: [0] })).toBe(250);
    expect(getRetailSalePrice({ price: 250, salePriceOptions: [0, 800] })).toBe(250);
  });

  it('treats missing wholesale option as unavailable', () => {
    expect(getWholesaleSalePrice({ salePriceOptions: [1000] })).toBe(0);
    expect(hasWholesaleSalePrice({ salePriceOptions: [1000] })).toBe(false);
  });

  it('matches active tier by numeric value', () => {
    expect(matchesProductSalePriceTier(product, '800', 'wholesale')).toBe(true);
    expect(matchesProductSalePriceTier(product, '799', 'wholesale')).toBe(false);
  });
});