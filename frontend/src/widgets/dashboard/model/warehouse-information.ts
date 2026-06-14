import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import {
  buildProductWarehouseMetaById,
  buildSupplierOrdersByProductId,
  getIssuedSaleProductIds,
  getStockSupplierLabel,
  type StockWarehouseMeta,
} from './stock-balance';
import type { WarehouseItem } from './warehouse-panel';

export type WarehouseInformationView = 'products' | 'locations' | 'suppliers';
export type WarehouseInformationStatusFilter = 'all' | 'active' | 'inactive';
export type WarehouseInformationSortKey = 'quantity' | 'value' | 'latest';

export type WarehouseInformationFilters = {
  search: string;
  warehouseId: string;
  locationId: string;
  supplier: string;
  status: WarehouseInformationStatusFilter;
  sort: WarehouseInformationSortKey;
};

export type WarehouseInformationSummary = {
  totalUnits: number;
  uniquePositions: number;
  purchaseValue: number;
  activeWarehouses: number;
  inactiveWarehousesWithStock: number;
  locationsWithStock: number;
};

export type WarehouseProductReportRow = {
  id: string;
  name: string;
  article: string;
  units: number;
  value: number;
  warehouses: string[];
  locations: string[];
  suppliers: string[];
  latestPurchaseDate: string | null;
};

export type WarehouseLocationReportRow = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  locationId: string;
  locationName: string;
  isWarehouseActive: boolean;
  units: number;
  uniqueProducts: number;
  value: number;
  latestPurchaseDate: string | null;
};

export type WarehouseSupplierReportRow = {
  id: string;
  supplierName: string;
  units: number;
  value: number;
  products: string[];
  warehouses: string[];
  latestPurchaseDate: string | null;
};

export type WarehouseInformationReport = {
  summary: WarehouseInformationSummary;
  products: WarehouseProductReportRow[];
  locations: WarehouseLocationReportRow[];
  suppliers: WarehouseSupplierReportRow[];
  warehouseMetaByProductId: Record<string, StockWarehouseMeta>;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? '').trim().toLowerCase();

const getLatestDate = (current: string | null, candidate: string | null) => {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime()
    ? candidate
    : current;
};

const addUnique = (values: string[], value: string) => {
  const normalizedValue = value.trim();
  if (normalizedValue && !values.includes(normalizedValue)) {
    values.push(normalizedValue);
  }
};

export const buildLocationUsageByWarehouse = (products: Product[]) =>
  products.reduce<Record<string, Record<string, number>>>((acc, product) => {
    const warehouseId = product.warehouseId?.trim();
    const locationId = product.locationId?.trim();
    if (!warehouseId || !locationId) return acc;
    acc[warehouseId] = acc[warehouseId] ?? {};
    acc[warehouseId][locationId] = (acc[warehouseId][locationId] ?? 0) + 1;
    return acc;
  }, {});

export const getWarehouseStockProducts = (
  products: Product[],
  sales: Sale[],
) => {
  const issuedProductIds = getIssuedSaleProductIds(products, sales);
  return products.filter(
    (product) => product.quantity > 0 && !issuedProductIds.has(product.id),
  );
};

const sortByInformationKey = <
  T extends {
    units: number;
    value: number;
    latestPurchaseDate: string | null;
  },
>(
  rows: T[],
  sort: WarehouseInformationSortKey,
) =>
  [...rows].sort((first, second) => {
    if (sort === 'value') return second.value - first.value;
    if (sort === 'latest') {
      return (
        new Date(second.latestPurchaseDate ?? 0).getTime() -
        new Date(first.latestPurchaseDate ?? 0).getTime()
      );
    }
    return second.units - first.units;
  });

export const buildWarehouseInformationReport = ({
  products,
  sales,
  warehouses,
  supplierOrders,
  filters,
}: {
  products: Product[];
  sales: Sale[];
  warehouses: WarehouseItem[];
  supplierOrders: SupplierOrder[];
  filters: WarehouseInformationFilters;
}): WarehouseInformationReport => {
  const stockProducts = getWarehouseStockProducts(products, sales);
  const warehouseMetaByProductId = buildProductWarehouseMetaById(
    stockProducts,
    warehouses,
  );
  const supplierOrdersByProductId = buildSupplierOrdersByProductId({
    products: stockProducts,
    supplierOrders,
  });
  const warehouseById = new Map(
    warehouses.map((warehouse) => [warehouse.id, warehouse]),
  );

  const filteredStockProducts = stockProducts.filter((product) => {
    const meta = warehouseMetaByProductId[product.id];
    const warehouse = warehouseById.get(meta?.warehouseId ?? '');
    const supplierLabel = getStockSupplierLabel(
      product,
      supplierOrdersByProductId[product.id],
    );
    const search = normalizeText(filters.search);
    if (
      search &&
      ![
        product.name,
        product.article,
        product.serialNumber,
        meta?.warehouseName,
        meta?.locationName,
        supplierLabel,
      ]
        .join(' ')
        .toLowerCase()
        .includes(search)
    ) {
      return false;
    }
    if (filters.warehouseId && meta?.warehouseId !== filters.warehouseId) {
      return false;
    }
    if (filters.locationId && meta?.locationId !== filters.locationId) {
      return false;
    }
    if (
      filters.supplier &&
      !normalizeText(supplierLabel).includes(normalizeText(filters.supplier))
    ) {
      return false;
    }
    if (filters.status === 'active' && warehouse?.isActive === false) {
      return false;
    }
    if (filters.status === 'inactive' && warehouse?.isActive !== false) {
      return false;
    }
    return true;
  });

  const productRows = new Map<string, WarehouseProductReportRow>();
  const locationRows = new Map<string, WarehouseLocationReportRow>();
  const supplierRows = new Map<string, WarehouseSupplierReportRow>();
  const activeWarehouseIdsWithStock = new Set<string>();
  const inactiveWarehouseIdsWithStock = new Set<string>();
  const locationIdsWithStock = new Set<string>();

  filteredStockProducts.forEach((product) => {
    const meta = warehouseMetaByProductId[product.id];
    const warehouse = warehouseById.get(meta?.warehouseId ?? '');
    const supplierLabel = getStockSupplierLabel(
      product,
      supplierOrdersByProductId[product.id],
    );
    const units = Math.max(0, product.quantity);
    const value = units * product.price;
    const productKey = `${normalizeText(product.name)}::${normalizeText(product.article)}`;
    const currentProduct =
      productRows.get(productKey) ??
      ({
        id: productKey,
        name: product.name || '-',
        article: product.article || '-',
        units: 0,
        value: 0,
        warehouses: [],
        locations: [],
        suppliers: [],
        latestPurchaseDate: null,
      } satisfies WarehouseProductReportRow);
    currentProduct.units += units;
    currentProduct.value += value;
    addUnique(currentProduct.warehouses, meta?.warehouseName ?? '-');
    addUnique(currentProduct.locations, meta?.locationName ?? '-');
    addUnique(currentProduct.suppliers, supplierLabel || '-');
    currentProduct.latestPurchaseDate = getLatestDate(
      currentProduct.latestPurchaseDate,
      product.purchaseDate,
    );
    productRows.set(productKey, currentProduct);

    const locationKey = `${meta?.warehouseId ?? ''}::${meta?.locationId ?? ''}`;
    const currentLocation =
      locationRows.get(locationKey) ??
      ({
        id: locationKey,
        warehouseId: meta?.warehouseId ?? '',
        warehouseName: meta?.warehouseName ?? '-',
        locationId: meta?.locationId ?? '',
        locationName: meta?.locationName ?? '-',
        isWarehouseActive: warehouse?.isActive !== false,
        units: 0,
        uniqueProducts: 0,
        value: 0,
        latestPurchaseDate: null,
      } satisfies WarehouseLocationReportRow);
    currentLocation.units += units;
    currentLocation.value += value;
    currentLocation.latestPurchaseDate = getLatestDate(
      currentLocation.latestPurchaseDate,
      product.purchaseDate,
    );
    locationRows.set(locationKey, currentLocation);

    const supplierKey = normalizeText(supplierLabel) || '-';
    const currentSupplier =
      supplierRows.get(supplierKey) ??
      ({
        id: supplierKey,
        supplierName: supplierLabel || '-',
        units: 0,
        value: 0,
        products: [],
        warehouses: [],
        latestPurchaseDate: null,
      } satisfies WarehouseSupplierReportRow);
    currentSupplier.units += units;
    currentSupplier.value += value;
    addUnique(currentSupplier.products, product.name);
    addUnique(currentSupplier.warehouses, meta?.warehouseName ?? '-');
    currentSupplier.latestPurchaseDate = getLatestDate(
      currentSupplier.latestPurchaseDate,
      product.purchaseDate,
    );
    supplierRows.set(supplierKey, currentSupplier);

    if (warehouse?.isActive === false) {
      inactiveWarehouseIdsWithStock.add(meta?.warehouseId ?? '');
    } else if (meta?.warehouseId) {
      activeWarehouseIdsWithStock.add(meta.warehouseId);
    }
    if (locationKey !== '::') locationIdsWithStock.add(locationKey);
  });

  const uniqueProductsByLocation = new Map<string, Set<string>>();
  filteredStockProducts.forEach((product) => {
    const meta = warehouseMetaByProductId[product.id];
    const locationKey = `${meta?.warehouseId ?? ''}::${meta?.locationId ?? ''}`;
    uniqueProductsByLocation.set(
      locationKey,
      uniqueProductsByLocation.get(locationKey) ?? new Set<string>(),
    );
    uniqueProductsByLocation.get(locationKey)?.add(
      `${normalizeText(product.name)}::${normalizeText(product.article)}`,
    );
  });
  locationRows.forEach((row) => {
    row.uniqueProducts = uniqueProductsByLocation.get(row.id)?.size ?? 0;
  });

  return {
    summary: {
      totalUnits: filteredStockProducts.reduce(
        (sum, product) => sum + Math.max(0, product.quantity),
        0,
      ),
      uniquePositions: productRows.size,
      purchaseValue: filteredStockProducts.reduce(
        (sum, product) => sum + Math.max(0, product.quantity) * product.price,
        0,
      ),
      activeWarehouses: activeWarehouseIdsWithStock.size,
      inactiveWarehousesWithStock: inactiveWarehouseIdsWithStock.size,
      locationsWithStock: locationIdsWithStock.size,
    },
    products: sortByInformationKey(
      Array.from(productRows.values()),
      filters.sort,
    ),
    locations: sortByInformationKey(
      Array.from(locationRows.values()),
      filters.sort,
    ),
    suppliers: sortByInformationKey(
      Array.from(supplierRows.values()),
      filters.sort,
    ),
    warehouseMetaByProductId,
  };
};

export const escapeCsvCell = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
