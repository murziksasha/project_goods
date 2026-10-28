import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import { getStockModelGroupId } from './stock-balance';
import type { ProductWarehouseMeta } from './warehouse-panel';

export type WarehouseBatchMode =
  | { type: 'group'; groupId: string }
  | { type: 'unit'; productId: string };

export type TransferProductClassification = {
  movers: Product[];
  stays: Product[];
};

export type DeletePartitionResult = {
  deletable: Product[];
  blocked: Product[];
};

export type SerialPreviewResult = {
  visibleSerials: string[];
  remainderCount: number;
};

export const getVisibleCheckedGroupProducts = (
  groupProducts: Product[],
  selectedProductIds: string[],
): Product[] => {
  const selectedSet = new Set(selectedProductIds);
  return groupProducts.filter((product) => selectedSet.has(product.id));
};

export const classifyTransferProducts = (
  products: Product[],
  productWarehouseMetaById: Record<string, ProductWarehouseMeta | undefined>,
  targetWarehouseId: string,
  targetLocationId: string,
): TransferProductClassification => {
  if (!targetWarehouseId || !targetLocationId) {
    return { movers: products, stays: [] };
  }
  const movers: Product[] = [];
  const stays: Product[] = [];
  for (const product of products) {
    const meta = productWarehouseMetaById[product.id];
    const isAtDestination =
      meta?.warehouseId === targetWarehouseId &&
      meta?.locationId === targetLocationId;
    if (isAtDestination) {
      stays.push(product);
    } else {
      movers.push(product);
    }
  }
  return { movers, stays };
};

export const partitionDeleteProducts = (
  products: Product[],
  salesByProductId: Record<string, Sale[] | undefined>,
): DeletePartitionResult => {
  const deletable: Product[] = [];
  const blocked: Product[] = [];
  for (const product of products) {
    const linkedSales = salesByProductId[product.id] ?? [];
    if (linkedSales.length > 0) {
      blocked.push(product);
    } else {
      deletable.push(product);
    }
  }
  return { deletable, blocked };
};

export const getSerialPreview = (
  products: Product[],
  maxVisible = 10,
): SerialPreviewResult => {
  const serials = products.map(
    (product) => product.serialNumber?.trim() || product.id,
  );
  return {
    visibleSerials: serials.slice(0, maxVisible),
    remainderCount: Math.max(0, serials.length - maxVisible),
  };
};

export const getActiveBatchProducts = (
  batchMode: WarehouseBatchMode | null,
  allProducts: Product[],
  filteredProducts: Product[],
  selectedProductIds: string[],
): {
  activeProducts: Product[];
  totalBatchUnitsCount: number;
  isMerelyHidden: boolean;
} => {
  if (!batchMode) {
    return {
      activeProducts: [],
      totalBatchUnitsCount: 0,
      isMerelyHidden: false,
    };
  }
  const selectedSet = new Set(selectedProductIds);

  if (batchMode.type === 'unit') {
    const exists = allProducts.find((p) => p.id === batchMode.productId);
    if (!exists) {
      return {
        activeProducts: [],
        totalBatchUnitsCount: 0,
        isMerelyHidden: false,
      };
    }
    const visible = filteredProducts.filter((p) => p.id === batchMode.productId);
    return {
      activeProducts: visible,
      totalBatchUnitsCount: 1,
      isMerelyHidden: visible.length === 0,
    };
  }

  const checkedGroupInAll = allProducts.filter(
    (p) =>
      getStockModelGroupId(p) === batchMode.groupId && selectedSet.has(p.id),
  );
  const checkedGroupInFiltered = filteredProducts.filter(
    (p) =>
      getStockModelGroupId(p) === batchMode.groupId && selectedSet.has(p.id),
  );

  return {
    activeProducts: checkedGroupInFiltered,
    totalBatchUnitsCount: checkedGroupInAll.length,
    isMerelyHidden:
      checkedGroupInAll.length > 0 && checkedGroupInFiltered.length === 0,
  };
};

