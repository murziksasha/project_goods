import type { ServiceCatalogItem } from '../model/types';

export type ServiceSalePriceTier = 'retail' | 'wholesale1' | 'wholesale2';

const roundPrice = (value: number) => Math.round(value * 100) / 100;

type ServicePriceSource = Pick<ServiceCatalogItem, 'price' | 'salePriceOptions'>;

export const getServiceRetailSalePrice = (service: ServicePriceSource) =>
  roundPrice(service.price ?? 0);

export const getServiceWholesaleSalePrice = (
  service: ServicePriceSource,
  option: 1 | 2,
) => roundPrice(service.salePriceOptions[option - 1] ?? 0);

export const hasServiceWholesaleSalePrice = (service: ServicePriceSource) =>
  getServiceWholesaleSalePrice(service, 1) > 0 ||
  getServiceWholesaleSalePrice(service, 2) > 0;

export const getServiceSalePriceByTier = (
  service: ServicePriceSource,
  tier: ServiceSalePriceTier,
) => {
  if (tier === 'wholesale1') return getServiceWholesaleSalePrice(service, 1);
  if (tier === 'wholesale2') return getServiceWholesaleSalePrice(service, 2);
  return getServiceRetailSalePrice(service);
};

export const formatServiceSalePrice = (price: number) => String(roundPrice(price));

export const formatServiceRetailSalePrice = (service: ServicePriceSource) =>
  formatServiceSalePrice(getServiceRetailSalePrice(service));

export const matchesServiceSalePriceTier = (
  service: ServicePriceSource,
  value: string,
  tier: ServiceSalePriceTier,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return false;
  return roundPrice(parsed) === getServiceSalePriceByTier(service, tier);
};

export const getVisibleServiceSalePriceTiers = (
  service: ServicePriceSource,
): ServiceSalePriceTier[] => {
  const tiers: ServiceSalePriceTier[] = ['retail'];
  if (getServiceWholesaleSalePrice(service, 1) > 0) tiers.push('wholesale1');
  if (getServiceWholesaleSalePrice(service, 2) > 0) tiers.push('wholesale2');
  return tiers;
};
