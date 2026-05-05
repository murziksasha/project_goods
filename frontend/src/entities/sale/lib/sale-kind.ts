import type { Sale } from '../model/types';

export const isRepairOrder = (sale: Sale) =>
  sale.kind
    ? sale.kind === 'repair'
    : sale.note
        .split('\n')
        .some((line) => line.trim().toLowerCase() === 'type: repair');

export const isProductSale = (sale: Sale) => !isRepairOrder(sale);
