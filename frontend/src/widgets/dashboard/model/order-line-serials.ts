import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';

export type ProductSerialAvailability = {
  labelKey: string;
  selectable: boolean;
};

export type SerialUsage = {
  current: Set<string>;
  other: Set<string>;
};

export const normalizeSerialNumber = (value: string | undefined | null) =>
  String(value ?? '').trim().toUpperCase();

export const getSaleSerialUsage = (
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>,
  currentSaleId: string,
): SerialUsage => {
  const current = new Set<string>();
  const other = new Set<string>();

  sales.forEach((sale) => {
    const target = sale.id === currentSaleId ? current : other;
    const saleLevelSerial = normalizeSerialNumber(sale.product?.serialNumber);
    if (saleLevelSerial) target.add(saleLevelSerial);

    (sale.lineItems ?? []).forEach((lineItem) => {
      if (lineItem.kind !== 'product') return;
      (lineItem.serialNumbers ?? [])
        .map(normalizeSerialNumber)
        .filter(Boolean)
        .forEach((serial) => target.add(serial));
    });
  });

  return { current, other };
};

export const getProductSerialAvailability = (
  product: Product,
  serialUsage: SerialUsage,
): ProductSerialAvailability => {
  const serial = normalizeSerialNumber(product.serialNumber);

  if (!product.isActive) {
    return { labelKey: 'orders.serialAvailability.inactive', selectable: false };
  }
  if (serial && serialUsage.current.has(serial)) {
    return {
      labelKey: 'orders.serialAvailability.alreadyInThisOrder',
      selectable: false,
    };
  }
  if (serial && serialUsage.other.has(serial)) {
    return {
      labelKey: 'orders.serialAvailability.linkedToAnotherOrder',
      selectable: false,
    };
  }
  if (!product.isInStock || product.freeQuantity <= 0) {
    return { labelKey: 'orders.serialAvailability.noFreeStock', selectable: false };
  }

  return { labelKey: 'orders.serialAvailability.free', selectable: true };
};

export const buildSerializedProductLineItem = ({
  product,
  price,
  warrantyPeriod,
}: {
  product: Product;
  price: number;
  warrantyPeriod: number;
}) => ({
  kind: 'product' as const,
  productId: product.id,
  name: product.name,
  price,
  quantity: 1,
  warrantyPeriod,
  serialNumbers: [normalizeSerialNumber(product.serialNumber)],
});