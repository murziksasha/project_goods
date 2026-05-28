import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';

export type ProductModelPriceForm = {
  article: string;
  note: string;
  retailPrice: string;
  wholesalePrice: string;
  purchasePrice: string;
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

export const getProductModelInitialForm = (
  products: Product[],
): ProductModelPriceForm => {
  const firstProduct = products[0];

  return {
    article: firstProduct?.article ?? '',
    note: firstProduct?.note ?? '',
    retailPrice: String(firstProduct?.salePriceOptions?.[0] ?? ''),
    wholesalePrice: String(firstProduct?.salePriceOptions?.[1] ?? ''),
    purchasePrice: String(firstProduct?.price ?? ''),
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
  purchasePrice: form.purchasePrice,
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
