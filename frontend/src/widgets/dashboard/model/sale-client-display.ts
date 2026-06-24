import type { TFunction } from 'i18next';
import type { Sale } from '../../../entities/sale/model/types';

export const getSaleClientDisplayName = (sale: Sale, t: TFunction) =>
  sale.isRapidSale ? t('orders.rapidSale.clientLabel') : sale.client.name;

export const isRapidSaleClientLinkDisabled = (sale: Sale) => sale.isRapidSale === true;

export const getSaleClientSearchValues = (sale: Sale, t: TFunction) => {
  const displayName = getSaleClientDisplayName(sale, t);
  return sale.isRapidSale
    ? [displayName, t('orders.rapidSale.clientLabel').toLowerCase(), 'rapid sale']
    : [displayName];
};