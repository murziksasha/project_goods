import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { parseDecimal } from '../../../shared/lib/decimal';
import {
  buildCreateOrderProductSuggestions,
  type CreateOrderProductSuggestion,
} from './create-order-products';

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

export const buildRapidSaleStockSuggestions = ({
  products,
  sales,
  query,
  limit = 8,
}: {
  products: Product[];
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>;
  query: string;
  limit?: number;
}): CreateOrderProductSuggestion[] =>
  buildCreateOrderProductSuggestions({
    products,
    catalogProducts: [],
    sales,
    query,
    limit,
  }).filter((suggestion) => suggestion.source === 'stock' && suggestion.selectable);

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

  const total = getRapidSaleDraftTotal(items);
  if (!Number.isFinite(total) || total < 0) {
    return 'orders.rapidSale.errors.invalidTotal';
  }

  return null;
};