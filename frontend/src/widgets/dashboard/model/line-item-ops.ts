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
