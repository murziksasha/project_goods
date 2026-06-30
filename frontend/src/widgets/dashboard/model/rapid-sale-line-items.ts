import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { parseDecimal } from '../../../shared/lib/decimal';
import {
  buildCreateOrderProductSuggestions,
  type CreateOrderProductSuggestion,
} from './create-order-products';
import {
  buildInMemorySerialUsageSale,
  collectOccupiedSerialNumbers,
  normalizeSerialNumber,
} from './order-line-serials';

export type RapidSaleProductDraft = {
  id: string;
  productId: string;
  name: string;
  price: string;
  quantity: string;
  warrantyPeriod: string;
  serialNumbers?: string[];
};

export type RapidSaleServiceDraft = {
  id: string;
  serviceId?: string;
  name: string;
  price: string;
  quantity: string;
  warrantyPeriod: string;
};

export type RapidSaleDraftItem =
  | (RapidSaleProductDraft & { kind: 'product' })
  | (RapidSaleServiceDraft & { kind: 'service' });

export const getRapidSaleOccupiedSerialNumbers = (
  draftItems: RapidSaleDraftItem[],
  pendingSerialNumbers: string[] = [],
): string[] =>
  collectOccupiedSerialNumbers([
    ...draftItems.flatMap((item) =>
      item.kind === 'product' ? (item.serialNumbers ?? []) : [],
    ),
    ...pendingSerialNumbers,
  ]);

export const buildRapidSaleStockSuggestions = ({
  products,
  sales,
  query,
  draftItems = [],
  pendingSerialNumbers = [],
  limit = 8,
}: {
  products: Product[];
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>;
  query: string;
  draftItems?: RapidSaleDraftItem[];
  pendingSerialNumbers?: string[];
  limit?: number;
}): CreateOrderProductSuggestion[] => {
  const occupiedSerialNumbers = getRapidSaleOccupiedSerialNumbers(
    draftItems,
    pendingSerialNumbers,
  );
  const draftSerialSale =
    occupiedSerialNumbers.length > 0
      ? buildInMemorySerialUsageSale(occupiedSerialNumbers)
      : null;

  return buildCreateOrderProductSuggestions({
    products,
    catalogProducts: [],
    sales: draftSerialSale ? [...sales, draftSerialSale] : sales,
    query,
    limit,
    currentSaleId: '',
  }).filter((suggestion) => suggestion.source === 'stock' && suggestion.selectable);
};

export const buildRapidSaleLineItems = (
  items: RapidSaleDraftItem[],
): Sale['lineItems'] =>
  items.map((item) => {
    if (item.kind === 'service') {
      return {
        id: item.id,
        kind: 'service' as const,
        serviceId: item.serviceId || undefined,
        name: item.name.trim(),
        price: parseDecimal(item.price),
        quantity: Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1),
        warrantyPeriod: Math.max(
          0,
          Number.parseInt(item.warrantyPeriod || '1', 10) || 1,
        ),
      };
    }

    return {
      id: item.id,
      kind: 'product' as const,
      productId: item.productId,
      name: item.name.trim(),
      price: parseDecimal(item.price),
      quantity: Math.max(1, Number.parseInt(item.quantity || '1', 10) || 1),
      warrantyPeriod: Math.max(
        0,
        Number.parseInt(item.warrantyPeriod || '0', 10) || 0,
      ),
      serialNumbers: item.serialNumbers ?? [],
    };
  });

export const getRapidSaleDraftTotal = (items: RapidSaleDraftItem[]) =>
  items.reduce((total, item) => {
    const price = parseDecimal(item.price);
    const quantity = Number.parseInt(item.quantity || '1', 10) || 1;
    return total + (Number.isFinite(price) ? price : 0) * quantity;
  }, 0);

export const validateRapidSaleDraft = (items: RapidSaleDraftItem[]) => {
  if (items.length < 1) {
    return 'orders.rapidSale.errors.noItems';
  }

  const invalidProduct = items.find(
    (item) => item.kind === 'product' && !item.productId.trim(),
  );
  if (invalidProduct) {
    return 'orders.rapidSale.errors.stockOnly';
  }

  const seenSerials = new Set<string>();
  const hasDuplicateSerial = items.some((item) => {
    if (item.kind !== 'product') return false;

    return (item.serialNumbers ?? []).some((serial) => {
      const normalized = normalizeSerialNumber(serial);
      if (!normalized) return false;
      if (seenSerials.has(normalized)) return true;
      seenSerials.add(normalized);
      return false;
    });
  });
  if (hasDuplicateSerial) {
    return 'orders.rapidSale.errors.duplicateSerial';
  }

  const total = getRapidSaleDraftTotal(items);
  if (!Number.isFinite(total) || total < 0) {
    return 'orders.rapidSale.errors.invalidTotal';
  }

  return null;
};