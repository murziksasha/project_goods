import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { normalizeSerialNumber } from './order-line-serials';
import {
  getIssuedSaleProductIds,
  getStockProductIdsLinkedToSale,
  isIssuedSaleStatus,
  type StockSaleLink,
} from './stock-balance';

export type ProductModelPriceForm = {
  article: string;
  note: string;
  retailPrice: string;
  wholesalePrice: string;
};

export type ProductModelSerialPurchaseRow = {
  productId: string;
  serialNumber: string;
  price: number;
  purchaseDate: string | null;
  isLatestBatch: boolean;
  isReserved: boolean;
};

export type ProductModelSaleLink = StockSaleLink & { id?: string };

const getBatchTimestamp = (product: Product) => {
  const raw = product.purchaseDate ?? product.createdAt;
  const time = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
};

export const getLatestBatchProduct = (products: Product[]): Product | null => {
  if (products.length === 0) return null;

  return [...products].sort((first, second) => {
    const timestampDiff =
      getBatchTimestamp(second) - getBatchTimestamp(first);
    if (timestampDiff !== 0) return timestampDiff;
    return second.createdAt.localeCompare(first.createdAt);
  })[0];
};

const getBatchKey = (product: Product) =>
  `${getBatchTimestamp(product)}::${product.price}`;

export const getReservedProductIdsOnOtherSales = (
  products: Product[],
  sales: ProductModelSaleLink[],
  currentSaleId?: string,
) => {
  const reservedProductIds = new Set<string>();
  const currentId = currentSaleId?.trim() ?? '';

  sales.forEach((sale) => {
    if (isIssuedSaleStatus(sale.status)) return;
    if (currentId && sale.id === currentId) return;

    getStockProductIdsLinkedToSale(sale, products).forEach((productId) =>
      reservedProductIds.add(productId),
    );
  });

  return reservedProductIds;
};

export const getReservedProductIdsFromOccupiedSerials = (
  products: Product[],
  occupiedSerials: Iterable<string>,
) => {
  const occupied = new Set(
    [...occupiedSerials].map(normalizeSerialNumber).filter(Boolean),
  );
  const reservedProductIds = new Set<string>();

  products.forEach((product) => {
    const serial = normalizeSerialNumber(product.serialNumber);
    if (serial && occupied.has(serial)) {
      reservedProductIds.add(product.id);
    }
  });

  return reservedProductIds;
};

export const buildProductModelSerialPurchases = (
  products: Product[],
  reservedProductIds: ReadonlySet<string> = new Set(),
): ProductModelSerialPurchaseRow[] => {
  const latestBatchProduct = getLatestBatchProduct(products);
  const latestBatchKey = latestBatchProduct
    ? getBatchKey(latestBatchProduct)
    : '';

  return [...products]
    .sort((first, second) => {
      const dateDiff = getBatchTimestamp(second) - getBatchTimestamp(first);
      if (dateDiff !== 0) return dateDiff;
      const serialDiff = first.serialNumber.localeCompare(
        second.serialNumber,
        undefined,
        { numeric: true, sensitivity: 'base' },
      );
      if (serialDiff !== 0) return serialDiff;
      return first.createdAt.localeCompare(second.createdAt);
    })
    .map((product) => ({
      productId: product.id,
      serialNumber: product.serialNumber.trim(),
      price: product.price,
      purchaseDate: product.purchaseDate ?? product.createdAt ?? null,
      isLatestBatch: getBatchKey(product) === latestBatchKey,
      isReserved: reservedProductIds.has(product.id),
    }));
};

export type ProductModelWarehouseSummary = {
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  totalStock: number;
  freeStock: number;
  reservedStock: number;
};

export const normalizeProductModelName = (value: string) =>
  value.trim().toLowerCase();

export const getProductsByExactModelName = (
  products: Product[],
  name: string,
) => {
  const normalizedName = normalizeProductModelName(name);
  if (!normalizedName) return [];

  return products.filter(
    (product) => normalizeProductModelName(product.name) === normalizedName,
  );
};

export const isProductActiveStockUnit = (
  product: Pick<Product, 'id' | 'quantity'>,
  issuedProductIds: ReadonlySet<string>,
) => product.quantity > 0 && !issuedProductIds.has(product.id);

export const getActiveStockProductsByExactModelName = (
  products: Product[],
  sales: StockSaleLink[],
  name: string,
) => {
  const issuedProductIds = getIssuedSaleProductIds(products, sales);

  return getProductsByExactModelName(products, name).filter((product) =>
    isProductActiveStockUnit(product, issuedProductIds),
  );
};

export const getProductModelInitialForm = (
  products: Product[],
): ProductModelPriceForm => {
  const firstProduct = products[0];

  return {
    article: firstProduct?.article ?? '',
    note: firstProduct?.note ?? '',
    retailPrice: String(firstProduct?.salePriceOptions?.[0] ?? ''),
    wholesalePrice: String(firstProduct?.salePriceOptions?.[1] ?? ''),
  };
};

export const buildProductModelSavePayload = (
  name: string,
  form: ProductModelPriceForm,
) => ({
  name,
  article: form.article,
  note: form.note,
  retailPrice: form.retailPrice,
  wholesalePrice: form.wholesalePrice,
});

const getWarehouseMeta = (
  product: Product,
  warehouses: WarehouseItem[],
) => {
  const byId = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const byName = new Map(
    warehouses.map((warehouse) => [
      warehouse.name.trim().toLowerCase(),
      warehouse,
    ]),
  );
  const fallbackWarehouse = warehouses[0];
  const warehouse =
    (product.warehouseId ? byId.get(product.warehouseId) : undefined) ??
    byName.get(product.purchasePlace.trim().toLowerCase()) ??
    fallbackWarehouse;
  const location =
    product.locationId && warehouse
      ? warehouse.locations.find((item) => item.id === product.locationId)
      : undefined;
  const fallbackLocation = location ?? warehouse?.locations[0];

  return {
    warehouseId: warehouse?.id ?? '',
    warehouseName: warehouse?.name ?? '-',
    locationId: fallbackLocation?.id ?? '',
    locationName: fallbackLocation?.name ?? '-',
  };
};

export const aggregateProductModelStock = (
  products: Product[],
  warehouses: WarehouseItem[],
) => {
  const summaryByLocation = new Map<string, ProductModelWarehouseSummary>();

  products.forEach((product) => {
    const meta = getWarehouseMeta(product, warehouses);
    const key = `${meta.warehouseId}::${meta.locationId}`;
    const current =
      summaryByLocation.get(key) ??
      ({
        ...meta,
        totalStock: 0,
        freeStock: 0,
        reservedStock: 0,
      } satisfies ProductModelWarehouseSummary);

    current.totalStock += product.quantity;
    current.freeStock += product.freeQuantity;
    current.reservedStock += product.reservedQuantity;
    summaryByLocation.set(key, current);
  });

  return Array.from(summaryByLocation.values()).sort((a, b) =>
    `${a.warehouseName} ${a.locationName}`.localeCompare(
      `${b.warehouseName} ${b.locationName}`,
    ),
  );
};
