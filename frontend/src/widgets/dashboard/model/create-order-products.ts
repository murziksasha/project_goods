import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
} from './order-line-serials';
import {
  buildProductWarehouseMetaById,
  type StockWarehouseItem,
} from './stock-balance';
import { parseDecimal } from '../../../shared/lib/decimal';
import i18n from '../../../shared/i18n/config';

export type CreateOrderProductSuggestion = {
  id: string;
  source: 'stock' | 'catalog';
  name: string;
  note: string;
  productId: string;
  catalogProductId: string;
  article: string;
  serialNumber: string;
  price: number;
  warrantyPeriod: number;
  availabilityLabel: string;
  selectable: boolean;
};

export type OrderDetailProductSuggestion = CreateOrderProductSuggestion & {
  warehouseName?: string;
};

export type NormalizedCreateOrderSaleItem = {
  id: string;
  productId: string;
  catalogProductId?: string;
  name: string;
  article: string;
  serialNumber: string;
  serialNumbers?: string[];
  price: string;
  quantity: string;
  warrantyPeriod: string;
  warehouse: string;
};

export const normalizeCreateOrderProductLookup = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ');

const getDefaultProductSalePrice = (product: Product) =>
  product.salePriceOptions[0] ?? product.price ?? 0;

const getStockProductRank = (product: Product, query: string) => {
  const serial = normalizeCreateOrderProductLookup(product.serialNumber);
  const article = normalizeCreateOrderProductLookup(product.article);
  const name = normalizeCreateOrderProductLookup(product.name);

  if (serial && serial === query) return 0;
  if (article && article === query) return 1;
  if (serial && serial.includes(query)) return 2;
  if (article && article.includes(query)) return 3;
  if (name && name.includes(query)) return 4;
  return 5;
};

export const buildCreateOrderProductSuggestions = ({
  products,
  catalogProducts,
  sales,
  query,
  limit = 8,
  currentSaleId = '',
}: {
  products: Product[];
  catalogProducts: CatalogProduct[];
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>;
  query: string;
  limit?: number;
  currentSaleId?: string;
}): CreateOrderProductSuggestion[] => {
  const normalizedQuery = normalizeCreateOrderProductLookup(query);
  if (normalizedQuery.length < 2) return [];

  const serialUsage = getSaleSerialUsage(sales, currentSaleId);
  const matchedStockSuggestions = products
    .filter((product) => {
      const fields = [
        product.name,
        product.article,
        product.serialNumber,
        product.note,
      ];
      return fields.some((field) =>
        normalizeCreateOrderProductLookup(field ?? '').includes(
          normalizedQuery,
        ),
      );
    })
    .map((product) => {
      const availability = getProductSerialAvailability(product, serialUsage);
      return {
        id: `stock-${product.id}`,
        source: 'stock' as const,
        name: product.name,
        note: product.note || i18n.t('orders.create.warehouseStock'),
        productId: product.id,
        catalogProductId: '',
        article: product.article,
        serialNumber: normalizeSerialNumber(product.serialNumber),
        price: getDefaultProductSalePrice(product),
        warrantyPeriod: product.warrantyPeriod,
        availabilityLabel: i18n.t(availability.labelKey),
        selectable: availability.selectable,
        rank: getStockProductRank(product, normalizedQuery),
      };
    });
  const unavailableStockNames = new Set(
    matchedStockSuggestions
      .filter((product) => !product.selectable)
      .map((product) => normalizeCreateOrderProductLookup(product.name))
      .filter(Boolean),
  );
  const stockMatches = matchedStockSuggestions
    .filter((product) => product.selectable)
    .sort((first, second) => {
      if (first.rank !== second.rank) return first.rank - second.rank;
      return first.name.localeCompare(second.name);
    });

  const catalogMatches = catalogProducts
    .filter((product) => product.isActive !== false)
    .filter((product) =>
      [product.name, product.note].some((field) =>
        normalizeCreateOrderProductLookup(field ?? '').includes(
          normalizedQuery,
        ),
      ),
    )
    .filter(
      (product) =>
        !unavailableStockNames.has(
          normalizeCreateOrderProductLookup(product.name),
        ),
    )
    .slice(0, limit)
    .map((product) => ({
      id: `catalog-${product.id}`,
      source: 'catalog' as const,
      name: product.name,
      note: product.note || i18n.t('orders.create.catalogProduct'),
      productId: '',
      catalogProductId: product.id,
      article: '',
      serialNumber: '',
      price: 0,
      warrantyPeriod: 0,
      availabilityLabel: i18n.t('orders.create.catalogSource'),
      selectable: true,
    }));

  return [...stockMatches, ...catalogMatches].slice(0, limit);
};

const getOrderDetailStockProductRank = (product: Product, query: string) => {
  const serial = normalizeCreateOrderProductLookup(product.serialNumber);
  const article = normalizeCreateOrderProductLookup(product.article);

  if (serial && serial === query) return 0;
  if (article && article === query) return 1;
  if (serial && serial.includes(query)) return 2;
  if (article && article.includes(query)) return 3;
  return 4;
};

const stockProductMatchesSerialOrArticle = (
  product: Product,
  normalizedQuery: string,
) => {
  const serial = normalizeCreateOrderProductLookup(product.serialNumber);
  const article = normalizeCreateOrderProductLookup(product.article);

  return (
    (serial && serial.includes(normalizedQuery)) ||
    (article && article.includes(normalizedQuery))
  );
};

const isOrderDetailStockLookupQuery = (
  products: Product[],
  normalizedQuery: string,
) =>
  products.some((product) =>
    stockProductMatchesSerialOrArticle(product, normalizedQuery),
  );

export const buildOrderDetailProductSuggestions = ({
  products,
  catalogProducts,
  sales,
  query,
  warehouses,
  limit = 8,
  currentSaleId = '',
}: {
  products: Product[];
  catalogProducts: CatalogProduct[];
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>;
  query: string;
  warehouses: StockWarehouseItem[];
  limit?: number;
  currentSaleId?: string;
}): OrderDetailProductSuggestion[] => {
  const normalizedQuery = normalizeCreateOrderProductLookup(query);
  if (normalizedQuery.length < 2) return [];

  if (isOrderDetailStockLookupQuery(products, normalizedQuery)) {
    const serialUsage = getSaleSerialUsage(sales, currentSaleId);
    const warehouseMetaByProductId = buildProductWarehouseMetaById(
      products,
      warehouses,
    );

    return products
      .filter((product) =>
        stockProductMatchesSerialOrArticle(product, normalizedQuery),
      )
      .map((product) => {
        const availability = getProductSerialAvailability(product, serialUsage);
        return {
          id: `stock-${product.id}`,
          source: 'stock' as const,
          name: product.name,
          note: product.note || i18n.t('orders.create.warehouseStock'),
          productId: product.id,
          catalogProductId: '',
          article: product.article,
          serialNumber: normalizeSerialNumber(product.serialNumber),
          price: getDefaultProductSalePrice(product),
          warrantyPeriod: product.warrantyPeriod,
          availabilityLabel: i18n.t(availability.labelKey),
          selectable: availability.selectable,
          warehouseName:
            warehouseMetaByProductId[product.id]?.warehouseName ?? '-',
          rank: getOrderDetailStockProductRank(product, normalizedQuery),
        };
      })
      .filter((product) => product.selectable)
      .sort((first, second) => {
        if (first.rank !== second.rank) return first.rank - second.rank;
        return first.name.localeCompare(second.name);
      })
      .slice(0, limit)
      .map(({ rank: _rank, ...suggestion }) => suggestion);
  }

  return catalogProducts
    .filter((product) => product.isActive !== false)
    .filter((product) =>
      normalizeCreateOrderProductLookup(product.name).includes(normalizedQuery),
    )
    .slice(0, limit)
    .map((product) => ({
      id: `catalog-${product.id}`,
      source: 'catalog' as const,
      name: product.name,
      note: product.note || i18n.t('orders.create.catalogProduct'),
      productId: '',
      catalogProductId: product.id,
      article: '',
      serialNumber: '',
      price: 0,
      warrantyPeriod: 0,
      availabilityLabel: i18n.t('orders.create.catalogSource'),
      selectable: true,
    }));
};

export const buildCreateOrderSaleLineItems = (
  saleItems: NormalizedCreateOrderSaleItem[],
) =>
  saleItems.map((item) => ({
    id: item.id,
    kind: 'product' as const,
    productId: item.productId || undefined,
    catalogProductId: item.catalogProductId || undefined,
    name: item.name,
    price: parseDecimal(item.price),
    quantity: Number(item.quantity),
    warrantyPeriod: Number(item.warrantyPeriod),
    serialNumbers: item.serialNumbers ?? [],
  }));
