import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import { parseDecimal } from '../../../shared/lib/decimal';
import {
  buildCreateOrderProductSuggestions,
  normalizeCreateOrderProductLookup,
  type CreateOrderProductSuggestion,
} from './create-order-products';
import {
  buildInMemorySerialUsageSale,
  collectOccupiedSerialNumbers,
  normalizeSerialNumber,
} from './order-line-serials';
import { getIssuedSaleProductIds } from './stock-balance';

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

type RapidSaleSuggestionSale = Pick<Sale, 'id' | 'product' | 'lineItems'> & {
  status?: string;
};

/** Serials the occupancy request must check for this query. Wider than the visible limit. */
export const collectRapidSaleCandidateSerials = (
  products: Product[],
  query: string,
): string[] => {
  const normalizedQuery = normalizeCreateOrderProductLookup(query);
  if (normalizedQuery.length < 2) return [];

  const serials = new Set<string>();
  products.forEach((product) => {
    if (product.quantity <= 0) return;
    const matches = [
      product.name,
      product.article,
      product.serialNumber,
      product.note,
    ].some((field) =>
      normalizeCreateOrderProductLookup(field ?? '').includes(normalizedQuery),
    );
    if (!matches) return;
    const serial = normalizeSerialNumber(product.serialNumber);
    if (serial) serials.add(serial);
  });

  return [...serials];
};

const isVisibleRapidSaleStock = (
  product: Product,
  issuedProductIds: Set<string>,
  occupancyUnavailable: boolean,
) => {
  if (product.quantity <= 0 || issuedProductIds.has(product.id)) return false;
  if (occupancyUnavailable && normalizeSerialNumber(product.serialNumber)) {
    return false;
  }
  return true;
};

export const buildRapidSaleStockSuggestions = ({
  products,
  sales,
  query,
  draftItems = [],
  pendingSerialNumbers = [],
  occupiedSerialNumbers = [],
  occupancyUnavailable = false,
  limit = 8,
}: {
  products: Product[];
  sales: RapidSaleSuggestionSale[];
  query: string;
  draftItems?: RapidSaleDraftItem[];
  pendingSerialNumbers?: string[];
  /** Serials returned by `GET /sales/occupied-serials`. Not the paged sales list. */
  occupiedSerialNumbers?: string[];
  /** When the occupancy request fails, serialized units are omitted. */
  occupancyUnavailable?: boolean;
  limit?: number;
}): CreateOrderProductSuggestion[] => {
  const issuedProductIds = getIssuedSaleProductIds(
    products,
    sales.map((sale) => ({
      status: sale.status ?? '',
      product: sale.product,
      lineItems: sale.lineItems,
    })),
  );
  const visibleProducts = products.filter((product) =>
    isVisibleRapidSaleStock(product, issuedProductIds, occupancyUnavailable),
  );
  const blockedSerialNumbers = [
    ...getRapidSaleOccupiedSerialNumbers(draftItems, pendingSerialNumbers),
    ...occupiedSerialNumbers,
  ];
  const draftSerialSale =
    blockedSerialNumbers.length > 0
      ? buildInMemorySerialUsageSale(blockedSerialNumbers)
      : null;

  return buildCreateOrderProductSuggestions({
    products: visibleProducts,
    catalogProducts: [],
    sales: draftSerialSale ? [...sales, draftSerialSale] : sales,
    query,
    limit,
    currentSaleId: '',
    orderStockByReceiptAge: true,
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