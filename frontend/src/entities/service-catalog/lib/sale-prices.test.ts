import { describe, expect, it } from 'vitest';
import {
  formatServiceRetailSalePrice,
  getServiceRetailSalePrice,
  getServiceSalePriceByTier,
  getServiceWholesaleSalePrice,
  getVisibleServiceSalePriceTiers,
  hasServiceWholesaleSalePrice,
  matchesServiceSalePriceTier,
} from './sale-prices';

const service = {
  price: 200,
  salePriceOptions: [150, 100],
};

describe('service sale-prices', () => {
  it('resolves retail and wholesale prices from price + salePriceOptions', () => {
    expect(getServiceRetailSalePrice(service)).toBe(200);
    expect(getServiceWholesaleSalePrice(service, 1)).toBe(150);
    expect(getServiceWholesaleSalePrice(service, 2)).toBe(100);
    expect(hasServiceWholesaleSalePrice(service)).toBe(true);
    expect(getServiceSalePriceByTier(service, 'retail')).toBe(200);
    expect(getServiceSalePriceByTier(service, 'wholesale1')).toBe(150);
    expect(getServiceSalePriceByTier(service, 'wholesale2')).toBe(100);
    expect(formatServiceRetailSalePrice(service)).toBe('200');
  });

  it('treats missing wholesale options as unavailable', () => {
    expect(getServiceWholesaleSalePrice({ price: 200, salePriceOptions: [] }, 1)).toBe(0);
    expect(getServiceWholesaleSalePrice({ price: 200, salePriceOptions: [0, 0] }, 2)).toBe(0);
    expect(hasServiceWholesaleSalePrice({ price: 200, salePriceOptions: [] })).toBe(false);
    expect(hasServiceWholesaleSalePrice({ price: 200, salePriceOptions: [0] })).toBe(false);
  });

  it('exposes only configured wholesale tiers', () => {
    expect(getVisibleServiceSalePriceTiers(service)).toEqual([
      'retail',
      'wholesale1',
      'wholesale2',
    ]);
    expect(
      getVisibleServiceSalePriceTiers({ price: 200, salePriceOptions: [150] }),
    ).toEqual(['retail', 'wholesale1']);
    expect(
      getVisibleServiceSalePriceTiers({ price: 200, salePriceOptions: [0, 100] }),
    ).toEqual(['retail', 'wholesale2']);
    expect(
      getVisibleServiceSalePriceTiers({ price: 200, salePriceOptions: [] }),
    ).toEqual(['retail']);
  });

  it('matches active tier by numeric value', () => {
    expect(matchesServiceSalePriceTier(service, '150', 'wholesale1')).toBe(true);
    expect(matchesServiceSalePriceTier(service, '149', 'wholesale1')).toBe(false);
    expect(matchesServiceSalePriceTier(service, '100', 'wholesale2')).toBe(true);
    expect(matchesServiceSalePriceTier(service, '200', 'retail')).toBe(true);
  });
});
