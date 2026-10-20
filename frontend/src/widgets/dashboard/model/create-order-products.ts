import type { CatalogProduct } from '../../../entities/catalog-product';
import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import {
  buildInMemorySerialUsageSale,
  getProductSerialAvailability,
  getSaleSerialUsage,
  normalizeSerialNumber,
} from './order-line-serials';
import {
  buildProductWarehouseMetaById,
  getIssuedSaleProductIds,
  type StockWarehouseItem,
} from './stock-balance';
import { getProductStockTimestamp } from './warehouse-serial-filter';
import { getRetailSalePrice } from '../../../entities/product';
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
  sortOrder?: number;
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

const getDefaultProductSalePrice = (product: Product) => getRetailSalePrice(product);

type OrderDetailSuggestionSale = Pick<Sale, 'id' | 'product' | 'lineItems'> & {
  status?: string;
};

const getOrderDetailIssuedProductIds = (
  products: Product[],
  sales: OrderDetailSuggestionSale[],
) =>
  getIssuedSaleProductIds(
    products,
    sales.map((sale) => ({
      status: sale.status ?? '',
      product: sale.product,
      lineItems: sale.lineItems,
    })),
  );

/** Stock balances visibility, plus fail-closed occupancy for serialized units. */
const isOrderDetailStockVisible = (
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

const getOrderDetailSerialUsage = (
  sales: OrderDetailSuggestionSale[],
  currentSaleId: string,
  occupiedSerialNumbers: string[],
) =>
  getSaleSerialUsage(
    occupiedSerialNumbers.length > 0
      ? [...sales, buildInMemorySerialUsageSale(occupiedSerialNumbers)]
      : sales,
    currentSaleId,
  );

export const findSelectableStockProductByName = ({
  products,
  catalogName,
  sales = [],
  currentSaleId = '',
  occupiedSerialNumbers = [],
  occupancyUnavailable = false,
}: {
  products: Product[];
  catalogName: string;
  sales?: OrderDetailSuggestionSale[];
  currentSaleId?: string;
  /** Serials returned by `GET /sales/occupied-serials`, plus unsaved draft serials. */
  occupiedSerialNumbers?: string[];
  /** When the occupancy request fails, serialized units are omitted. */
  occupancyUnavailable?: boolean;
}): Product | null => {
  const normalizedCatalogName = normalizeCreateOrderProductLookup(catalogName);
  if (!normalizedCatalogName) return null;

  const issuedProductIds = getOrderDetailIssuedProductIds(products, sales);
  const serialUsage = getOrderDetailSerialUsage(
    sales,
    currentSaleId,
    occupiedSerialNumbers,
  );
  const selectableMatches = products.filter((product) => {
    if (
      normalizeCreateOrderProductLookup(product.name) !== normalizedCatalogName
    ) {
      return false;
    }
    if (
      !isOrderDetailStockVisible(
        product,
        issuedProductIds,
        occupancyUnavailable,
      )
    ) {
      return false;
    }
    return getProductSerialAvailability(product, serialUsage).selectable;
  });

  if (selectableMatches.length === 0) return null;

  const bulkMatch = selectableMatches.find(
    (product) => !normalizeSerialNumber(product.serialNumber),
  );
  return bulkMatch ?? selectableMatches[0];
};

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
  orderStockByReceiptAge = false,
}: {
  products: Product[];
  catalogProducts: CatalogProduct[];
  sales: Array<Pick<Sale, 'id' | 'product' | 'lineItems'>>;
  query: string;
  limit?: number;
  currentSaleId?: string;
  /** Rapid sale: after rank and name, oldest receipt (`purchaseDate`, else `createdAt`) is first. */
  orderStockByReceiptAge?: boolean;
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
        sortOrder: product.sortOrder ?? 0,
        rank: getStockProductRank(product, normalizedQuery),
        receiptTime: getProductStockTimestamp(product),
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
      const sortDiff = (first.sortOrder ?? 0) - (second.sortOrder ?? 0);
      if (sortDiff !== 0) return sortDiff;
      if (first.rank !== second.rank) return first.rank - second.rank;
      const nameDiff = first.name.localeCompare(second.name);
      if (nameDiff !== 0) return nameDiff;
      if (!orderStockByReceiptAge) return 0;
      return first.receiptTime - second.receiptTime;
    })
    .map(({ receiptTime: _receiptTime, ...suggestion }) => suggestion);

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
      sortOrder: product.sortOrder ?? 0,
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

const catalogNamesForQuery = (
  catalogProducts: CatalogProduct[],
  normalizedQuery: string,
) =>
  new Set(
    catalogProducts
      .filter((product) => product.isActive !== false)
      .filter((product) =>
        normalizeCreateOrderProductLookup(product.name).includes(
          normalizedQuery,
        ),
      )
      .map((product) => normalizeCreateOrderProductLookup(product.name)),
  );

/** Serials the occupancy request must check. Wider than the visible limit. */
export const collectOrderDetailCandidateSerials = ({
  products,
  catalogProducts,
  query,
}: {
  products: Product[];
  catalogProducts: CatalogProduct[];
  query: string;
}): string[] => {
  const normalizedQuery = normalizeCreateOrderProductLookup(query);
  if (normalizedQuery.length < 2) return [];

  const catalogNames = catalogNamesForQuery(catalogProducts, normalizedQuery);
  const serials = new Set<string>();

  products.forEach((product) => {
    if (product.quantity <= 0) return;
    const serial = normalizeSerialNumber(product.serialNumber);
    if (!serial) return;
    const matchesSerialOrArticle = stockProductMatchesSerialOrArticle(
      product,
      normalizedQuery,
    );
    const matchesCatalogName = catalogNames.has(
      normalizeCreateOrderProductLookup(product.name),
    );
    if (!matchesSerialOrArticle && !matchesCatalogName) return;
    serials.add(serial);
  });

  return [...serials];
};

export const buildOrderDetailProductSuggestions = ({
  products,
  catalogProducts,
  sales,
  query,
  warehouses,
  limit = 8,
  currentSaleId = '',
  occupiedSerialNumbers = [],
  occupancyUnavailable = false,
}: {
  products: Product[];
  catalogProducts: CatalogProduct[];
  sales: OrderDetailSuggestionSale[];
  query: string;
  warehouses: StockWarehouseItem[];
  limit?: number;
  currentSaleId?: string;
  /** Serials returned by `GET /sales/occupied-serials`, plus unsaved draft serials. */
  occupiedSerialNumbers?: string[];
  /** When the occupancy request fails, serialized units are omitted. */
  occupancyUnavailable?: boolean;
}): OrderDetailProductSuggestion[] => {
  const normalizedQuery = normalizeCreateOrderProductLookup(query);
  if (normalizedQuery.length < 2) return [];

  if (isOrderDetailStockLookupQuery(products, normalizedQuery)) {
    const issuedProductIds = getOrderDetailIssuedProductIds(products, sales);
    const serialUsage = getOrderDetailSerialUsage(
      sales,
      currentSaleId,
      occupiedSerialNumbers,
    );
    const warehouseMetaByProductId = buildProductWarehouseMetaById(
      products,
      warehouses,
    );

    return products
      .filter((product) =>
        stockProductMatchesSerialOrArticle(product, normalizedQuery),
      )
      .filter((product) =>
        isOrderDetailStockVisible(
          product,
          issuedProductIds,
          occupancyUnavailable,
        ),
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
          sortOrder: product.sortOrder ?? 0,
          warehouseName:
            warehouseMetaByProductId[product.id]?.warehouseName ?? '-',
          rank: getOrderDetailStockProductRank(product, normalizedQuery),
        };
      })
      .filter((product) => product.selectable)
      .sort((first, second) => {
        const sortDiff = (first.sortOrder ?? 0) - (second.sortOrder ?? 0);
        if (sortDiff !== 0) return sortDiff;
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
      sortOrder: product.sortOrder ?? 0,
    }))
    .sort((first, second) => {
      const sortDiff = (first.sortOrder ?? 0) - (second.sortOrder ?? 0);
      if (sortDiff !== 0) return sortDiff;
      return first.name.localeCompare(second.name);
    })
    .slice(0, limit);
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
