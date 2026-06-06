import type mongoose from 'mongoose';

export type StockLine = {
  productId: string;
  quantity: number;
};

export type SaleLineItem = {
  id: string;
  kind: string;
  productId?: string | mongoose.Types.ObjectId | null;
  catalogProductId?: string | mongoose.Types.ObjectId | null;
  serviceId?: string | mongoose.Types.ObjectId | null;
  name: string;
  price: number;
  quantity: number;
  warrantyPeriod?: number;
  serialNumbers?: string[];
};

export const isStockCommittedSaleStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'paid' ||
    normalized === 'issued'
  );
};

export const isStockCommittedRepairStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === 'issued' ||
    normalized === 'issuedwithoutrepair'
  );
};

export const addStockQuantity = (
  stockMap: Map<string, number>,
  productId: string,
  quantity: number,
) => {
  stockMap.set(productId, (stockMap.get(productId) ?? 0) + quantity);
};

export const getStockLines = (
  kind: 'repair' | 'sale',
  status: string,
  lineItems: SaleLineItem[],
  fallbackQuantity: number,
  fallbackProductId?: mongoose.Types.ObjectId | string | null,
): StockLine[] => {
  const isStockCommitted =
    kind === 'sale'
      ? isStockCommittedSaleStatus(status)
      : isStockCommittedRepairStatus(status);

  if (!isStockCommitted) {
    return [];
  }

  const stockMap = new Map<string, number>();

  lineItems.forEach((item) => {
    const productId = item.productId?.toString();

    if (item.kind === 'product' && productId) {
      addStockQuantity(stockMap, productId, item.quantity);
    }
  });

  const normalizedFallbackProductId = fallbackProductId?.toString().trim();
  if (stockMap.size === 0 && normalizedFallbackProductId) {
    addStockQuantity(stockMap, normalizedFallbackProductId, fallbackQuantity);
  }

  return Array.from(stockMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

export const getStockDeltas = (
  currentLines: StockLine[],
  nextLines: StockLine[],
) => {
  const deltaMap = new Map<string, number>();

  currentLines.forEach((line) => {
    addStockQuantity(deltaMap, line.productId, -line.quantity);
  });
  nextLines.forEach((line) => {
    addStockQuantity(deltaMap, line.productId, line.quantity);
  });

  return Array.from(deltaMap.entries())
    .map(([productId, quantity]) => ({ productId, quantity }))
    .filter((line) => line.quantity !== 0);
};
