import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';

const normalizeWarehouseText = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase();

export type WarehouseOption = {
  id: string;
  name: string;
};

export const getActiveWarehouseOptions = (
  warehouses: WarehouseItem[],
): WarehouseOption[] =>
  warehouses
    .filter((warehouse) => warehouse.isActive)
    .map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
    }));

export const getDefaultWarehouseId = (warehouses: WarehouseItem[]): string => {
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.isActive);
  return (activeWarehouses[0] ?? warehouses[0])?.id ?? '';
};

export const productMatchesWarehouse = (
  product: Product,
  warehouseId: string,
  warehouses: WarehouseItem[],
): boolean => {
  if (!warehouseId) return true;

  const productWarehouseId = product.warehouseId?.trim();
  if (productWarehouseId) {
    return productWarehouseId === warehouseId;
  }

  const warehouse = warehouses.find((item) => item.id === warehouseId);
  if (!warehouse) return false;

  return (
    normalizeWarehouseText(product.purchasePlace) ===
    normalizeWarehouseText(warehouse.name)
  );
};

export const filterProductsByWarehouse = (
  products: Product[],
  warehouseId: string,
  warehouses: WarehouseItem[],
): Product[] => {
  if (!warehouseId) return products;
  return products.filter((product) =>
    productMatchesWarehouse(product, warehouseId, warehouses),
  );
};

const getProductStockTimestamp = (product: Product): number => {
  const timestamp = new Date(
    product.purchaseDate ?? product.createdAt,
  ).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

export const sortProductsOldestFirst = (products: Product[]): Product[] =>
  [...products].sort(
    (first, second) =>
      getProductStockTimestamp(first) - getProductStockTimestamp(second),
  );

export const getWarehouseFilteredProductsOldestFirst = (
  products: Product[],
  warehouseId: string,
  warehouses: WarehouseItem[],
): Product[] =>
  sortProductsOldestFirst(
    filterProductsByWarehouse(products, warehouseId, warehouses),
  );

export const selectOldestSerialsForWarehouse = (
  products: Product[],
  warehouseId: string,
  warehouses: WarehouseItem[],
  limit: number,
  normalizeSerial: (value: string | null | undefined) => string,
): string[] => {
  if (!warehouseId || limit <= 0 || warehouses.length === 0) {
    return [];
  }

  return getWarehouseFilteredProductsOldestFirst(
    products,
    warehouseId,
    warehouses,
  )
    .map((product) => normalizeSerial(product.serialNumber))
    .filter(Boolean)
    .slice(0, limit);
};