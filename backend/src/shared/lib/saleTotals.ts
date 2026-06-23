import type { SaleDocument } from '../../domain/sale/model';

type LineItemLike = { price: number; quantity: number };

const calculateLineItemsTotal = (lineItems: LineItemLike[]) =>
  Math.round(
    lineItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    ) * 100,
  ) / 100;

const normalizeDiscount = (
  discount?: { mode?: string; value?: number } | null,
) => {
  const value =
    Number.isFinite(discount?.value) && (discount?.value ?? 0) > 0
      ? (discount?.value as number)
      : 0;

  return {
    mode: discount?.mode === 'percent' ? 'percent' : 'amount',
    value,
  } as const;
};

const calculateDiscountAmount = (
  total: number,
  discount?: { mode?: string; value?: number } | null,
) => {
  const normalized = normalizeDiscount(discount);
  if (normalized.value <= 0 || total <= 0) return 0;

  if (normalized.mode === 'percent') {
    return Math.min(
      Math.round(((total * normalized.value) / 100) * 100) / 100,
      total,
    );
  }

  return Math.min(Math.round(normalized.value * 100) / 100, total);
};

const getLineItemsTotal = (sale: SaleDocument) => {
  const lineItems = Array.isArray(sale.lineItems) ? sale.lineItems : [];
  if (lineItems.length > 0) {
    return calculateLineItemsTotal(lineItems);
  }

  return sale.salePrice * sale.quantity;
};

export const getSaleDocumentTotal = (sale: SaleDocument) => {
  const baseTotal = getLineItemsTotal(sale);
  const discountAmount = calculateDiscountAmount(baseTotal, sale.discount);
  return Math.max(Math.round((baseTotal - discountAmount) * 100) / 100, 0);
};