import type { Sale, SaleProductSnapshot } from '../model/types';

const repairPlaceholderNames = new Set(['REPAIR PLACEHOLDER']);
const repairPlaceholderSerials = new Set(['REPAIR-PLACEHOLDER']);

export const getSaleProductSnapshot = (sale: Sale): SaleProductSnapshot => ({
  id:
    sale.product?.id ??
    sale.lineItems.find((item) => item.kind === 'product')?.productId ??
    '',
  article: sale.product?.article ?? '',
  name:
    sale.product?.name ??
    sale.lineItems.find((item) => item.kind === 'product')?.name ??
    '',
  serialNumber: sale.product?.serialNumber ?? '',
});

export const getSaleProductName = (sale: Sale, fallback = '') => {
  const productName = sale.product?.name?.trim() ?? '';
  if (productName && !repairPlaceholderNames.has(productName.toUpperCase())) {
    return productName;
  }

  const lineItemName =
    sale.lineItems.find((item) => item.kind === 'product')?.name?.trim() ?? '';
  return lineItemName || productName || fallback;
};

export const getSaleProductSerialNumber = (sale: Sale) => {
  const serial = sale.product?.serialNumber?.trim() ?? '';
  if (!serial || repairPlaceholderSerials.has(serial.toUpperCase())) return '';
  return serial;
};

export const getSaleProductArticle = (sale: Sale) =>
  sale.product?.article?.trim() ?? '';

export const getSaleProductId = (sale: Sale) =>
  sale.product?.id ??
  sale.lineItems.find((item) => item.kind === 'product')?.productId ??
  '';
