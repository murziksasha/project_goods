import type { Sale, SaleProductSnapshot } from '../model/types';

const repairPlaceholderNames = new Set(['REPAIR PLACEHOLDER']);
const repairPlaceholderSerials = new Set(['REPAIR-PLACEHOLDER']);

export const getSaleProductSnapshot = (sale: Sale): SaleProductSnapshot => ({
  id:
    sale.product?.id ??
    (sale.lineItems ?? []).find((item) => item.kind === 'product')?.productId ??
    '',
  article: sale.product?.article ?? '',
  name:
    sale.product?.name ??
    (sale.lineItems ?? []).find((item) => item.kind === 'product')?.name ??
    (sale.lineItems ?? []).find((item) => item.kind === 'service')?.name ??
    '',
  serialNumber: sale.product?.serialNumber ?? '',
});

export const getSaleProductName = (sale: Sale, fallback = '') => {
  const productName = sale.product?.name?.trim() ?? '';
  if (productName && !repairPlaceholderNames.has(productName.toUpperCase())) {
    return productName;
  }

  const lineItemName =
    (sale.lineItems ?? []).find((item) => item.kind === 'product')?.name?.trim() ??
    (sale.lineItems ?? []).find((item) => item.kind === 'service')?.name?.trim() ??
    '';
  return lineItemName || productName || fallback;
};

export const getSaleProductSerialNumber = (sale: Pick<Sale, 'product'>) => {
  const serial = sale.product?.serialNumber?.trim() ?? '';
  if (!serial || repairPlaceholderSerials.has(serial.toUpperCase())) return '';
  return serial;
};

export const getSaleProductArticle = (sale: Sale) =>
  sale.product?.article?.trim() ?? '';

export const getSaleProductId = (sale: Sale) =>
  sale.product?.id ??
  (sale.lineItems ?? []).find((item) => item.kind === 'product')?.productId ??
  '';

/** Toolbar/list search haystack: every card line, not only the first Product cell. */
export const getSaleListSearchValues = (
  sale: Pick<Sale, 'product' | 'lineItems'>,
): string[] => {
  const values: string[] = [
    sale.product?.name ?? '',
    sale.product?.article ?? '',
    getSaleProductSerialNumber(sale),
  ];

  (sale.lineItems ?? []).forEach((item) => {
    values.push(item.name ?? '');
    (item.serialNumbers ?? []).forEach((serial) => values.push(serial));
  });

  return values.map((value) => value.trim()).filter(Boolean);
};

export const saleMatchesListSearchQuery = (
  sale: Pick<Sale, 'product' | 'lineItems'>,
  query: string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return getSaleListSearchValues(sale).some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
};
