type LineItemPatch = Partial<{
  name: string;
  productId: string;
  serviceId: string;
  price: number;
  quantity: number;
  warrantyPeriod: number;
  serialNumbers: string[];
}>;

type MinimalLineItem = {
  id: string;
  serialNumbers?: string[];
  quantity: number;
};

type MinimalPaymentLineItem = {
  id: string;
  price: number;
  quantity: number;
};

type LineItemsDiscount = {
  mode: 'amount' | 'percent';
  value: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const getLineItemsPaymentTotal = <T extends MinimalPaymentLineItem>(
  items: T[],
  discount: LineItemsDiscount = { mode: 'amount', value: 0 },
) => {
  const baseTotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  if (baseTotal <= 0) return 0;

  const normalizedDiscountValue =
    Number.isFinite(discount.value) && discount.value > 0
      ? discount.value
      : 0;
  const discountAmount =
    discount.mode === 'percent'
      ? Math.min(roundMoney((baseTotal * normalizedDiscountValue) / 100), baseTotal)
      : Math.min(roundMoney(normalizedDiscountValue), baseTotal);

  return Math.max(roundMoney(baseTotal - discountAmount), 0);
};

export const patchLineItemsById = <T extends MinimalLineItem>(
  items: T[],
  itemId: string,
  itemIndex: number | undefined,
  patch: LineItemPatch,
) => {
  const hasMatchingId = items.some((item) => item.id === itemId);
  return items.map((item, index) => {
    if (item.id === itemId) {
      return {
        ...item,
        ...patch,
        serialNumbers:
          patch.quantity !== undefined
            ? (patch.serialNumbers ?? item.serialNumbers)?.slice(
                0,
                patch.quantity,
              )
            : patch.serialNumbers ?? item.serialNumbers,
      };
    }
    if (!hasMatchingId && itemIndex !== undefined && itemIndex === index) {
      return { ...item, ...patch };
    }
    return item;
  });
};

export const removeLineItemsById = <T extends { id: string }>(
  items: T[],
  itemId: string,
  itemIndex?: number,
) => {
  const hasMatchingId = items.some((item) => item.id === itemId);
  return items.filter((item, index) =>
    item.id === itemId
      ? false
      : !hasMatchingId && itemIndex !== undefined
        ? index !== itemIndex
        : true,
  );
};

export const canRemoveLineItemAfterPayment = <
  T extends MinimalPaymentLineItem,
>(
  items: T[],
  itemId: string,
  itemIndex: number | undefined,
  paidAmount: number,
  discount: LineItemsDiscount = { mode: 'amount', value: 0 },
) => {
  if (paidAmount <= 0) return true;

  const nextItems = removeLineItemsById(items, itemId, itemIndex);
  if (nextItems.length === items.length) return false;

  return paidAmount <= getLineItemsPaymentTotal(nextItems, discount);
};
