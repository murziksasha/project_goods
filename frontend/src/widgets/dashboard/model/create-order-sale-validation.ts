type NamedSaleLineItem = {
  name: string;
};

export const getCreateOrderSaleTitle = (
  products: NamedSaleLineItem[],
  services: NamedSaleLineItem[],
) => products[0]?.name?.trim() ?? services[0]?.name?.trim() ?? '';

export const validateCreateOrderSaleLineItems = (
  products: NamedSaleLineItem[],
  services: NamedSaleLineItem[],
): string | null => {
  if (products.length > 0 || services.length > 0) {
    return null;
  }

  return 'dashboard.actions.errors.saleLineItemsRequired';
};