import type { Sale } from '../model/types';

type SaleListItem = Sale['lineItems'][number];

/** Sales list composition must never revive the creation-time product snapshot. */
export const getSaleListLineItems = (sale: Pick<Sale, 'lineItems'>) =>
  Array.isArray(sale.lineItems) ? sale.lineItems : [];

export const getSaleListPrimaryItem = (sale: Pick<Sale, 'lineItems'>) => {
  const items = getSaleListLineItems(sale);
  return (
    items.find((item) => item.kind === 'product') ??
    items.find((item) => item.kind === 'service') ??
    null
  );
};

export const getSaleListItemSerialNumbers = (
  item: Pick<SaleListItem, 'serialNumbers'> | null,
) =>
  (item?.serialNumbers ?? [])
    .map((serial) => serial.trim())
    .filter(Boolean);

export const getSaleListItemSerial = (
  item: Pick<SaleListItem, 'serialNumbers'> | null,
) => getSaleListItemSerialNumbers(item).join(', ');
