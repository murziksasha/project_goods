import type { Supplier } from '../../../entities/supplier/model/types';
import type {
  SupplierOrder,
  SupplierOrderItem,
} from '../../../entities/supplier-order/model/types';

export type SupplierOrderProductStat = {
  productName: string;
  quantity: number;
  total: number;
  lineCount: number;
  orderCount: number;
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
};

export type SupplierOrderSupplierStat = {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  total: number;
  paid: number;
  outstanding: number;
};

export type SupplierOrderPricePosition = {
  orderId: string;
  orderNumber: string;
  supplierName: string;
  productName: string;
  price: number;
  quantity: number;
  total: number;
} | null;

export type SupplierOrderAnalytics = {
  orderCount: number;
  totalValue: number;
  paidAmount: number;
  outstandingAmount: number;
  totalQuantity: number;
  averageOrderValue: number;
  paymentCoveragePercent: number;
  cancelledUnavailableRate: number;
  stockedRate: number;
  overdueCount: number;
  lateRiskCount: number;
  topProductsByQuantity: SupplierOrderProductStat[];
  topProductsByValue: SupplierOrderProductStat[];
  topProductsByFrequency: SupplierOrderProductStat[];
  productPriceRanges: SupplierOrderProductStat[];
  topSuppliersBySpend: SupplierOrderSupplierStat[];
  topSuppliersByPending: SupplierOrderSupplierStat[];
  lowestPricePosition: SupplierOrderPricePosition;
  highestPricePosition: SupplierOrderPricePosition;
};

export const getSupplierSuggestions = (
  suppliers: Supplier[],
  searchValue: string,
) => {
  const normalized = searchValue.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return suppliers
    .filter(
      (supplier) =>
        supplier.isActive &&
        [supplier.name, supplier.phone]
          .join(' ')
          .toLowerCase()
          .includes(normalized),
    )
    .slice(0, 8);
};

export const buildSupplierOrderItemNumber = (
  order: SupplierOrder,
  itemIndex: number,
) => {
  const baseNumber = order.number || order.orderBaseId || order.id;
  if (order.items.length <= 1) {
    return baseNumber;
  }
  return `${baseNumber}-${itemIndex + 1}`;
};

export const mergeSupplierOrderItemUpdate = ({
  sourceOrder,
  selectedItemIndex,
  updatedItem,
}: {
  sourceOrder: SupplierOrder;
  selectedItemIndex: number;
  updatedItem: SupplierOrderItem;
}) =>
  sourceOrder.items.map((item) =>
    item.itemIndex === selectedItemIndex
      ? {
          ...item,
          ...updatedItem,
          itemIndex: item.itemIndex,
        }
      : item,
  );

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const normalizeProductName = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const getOrderTotal = (order: SupplierOrder) => {
  if (Number.isFinite(order.total) && order.total > 0) {
    return order.total;
  }

  return order.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
};

const toDateOnlyTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  ).getTime();
};

export const buildSupplierOrderAnalytics = (
  orders: SupplierOrder[],
  currentDate: Date = new Date(),
): SupplierOrderAnalytics => {
  const productStats = new Map<
    string,
    SupplierOrderProductStat & { orderIds: Set<string> }
  >();
  const supplierStats = new Map<string, SupplierOrderSupplierStat>();
  let paidAmount = 0;
  let totalValue = 0;
  let totalQuantity = 0;
  let cancelledUnavailableCount = 0;
  let stockedCount = 0;
  let overdueCount = 0;
  let lateRiskCount = 0;
  let lowestPricePosition: SupplierOrderPricePosition = null;
  let highestPricePosition: SupplierOrderPricePosition = null;
  const currentDateTime = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  ).getTime();
  const lateRiskWindowMs = 3 * 24 * 60 * 60 * 1000;

  orders.forEach((order) => {
    const orderTotal = getOrderTotal(order);
    const orderPaid = Math.min(Math.max(order.paid, 0), orderTotal);
    const supplierKey = order.supplierId || order.supplierName;
    const supplierEntry =
      supplierStats.get(supplierKey) ?? {
        supplierId: order.supplierId,
        supplierName: order.supplierName || 'Unknown supplier',
        orderCount: 0,
        total: 0,
        paid: 0,
        outstanding: 0,
      };

    totalValue += orderTotal;
    paidAmount += orderPaid;
    supplierEntry.orderCount += 1;
    supplierEntry.total += orderTotal;
    supplierEntry.paid += orderPaid;
    supplierEntry.outstanding += Math.max(orderTotal - orderPaid, 0);
    supplierStats.set(supplierKey, supplierEntry);

    if (order.status === 'cancelled' || order.status === 'unavailable') {
      cancelledUnavailableCount += 1;
    }

    if (order.status === 'stocked' || order.receiptStatus === 'received') {
      stockedCount += 1;
    }

    const deliveryTime = toDateOnlyTime(order.deliveryDate);
    const isOpenOrder =
      order.status !== 'stocked' &&
      order.status !== 'cancelled' &&
      order.status !== 'unavailable' &&
      order.receiptStatus !== 'received';
    if (deliveryTime !== null && isOpenOrder) {
      if (deliveryTime < currentDateTime) {
        overdueCount += 1;
      } else if (deliveryTime - currentDateTime <= lateRiskWindowMs) {
        lateRiskCount += 1;
      }
    }

    order.items.forEach((item: SupplierOrderItem) => {
      const itemTotal = item.quantity * item.price;
      const productKey =
        item.catalogProductId || normalizeProductName(item.productName);
      const entry =
        productStats.get(productKey) ?? {
          productName: item.productName || 'Unnamed product',
          quantity: 0,
          total: 0,
          lineCount: 0,
          orderCount: 0,
          minPrice: item.price,
          maxPrice: item.price,
          averagePrice: 0,
          orderIds: new Set<string>(),
        };

      entry.quantity += item.quantity;
      entry.total += itemTotal;
      entry.lineCount += 1;
      entry.minPrice = Math.min(entry.minPrice, item.price);
      entry.maxPrice = Math.max(entry.maxPrice, item.price);
      entry.orderIds.add(order.id);
      entry.orderCount = entry.orderIds.size;
      productStats.set(productKey, entry);
      totalQuantity += item.quantity;

      const pricePosition = {
        orderId: order.id,
        orderNumber: buildSupplierOrderItemNumber(order, item.itemIndex),
        supplierName: order.supplierName,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        total: itemTotal,
      };

      if (
        lowestPricePosition === null ||
        item.price < lowestPricePosition.price
      ) {
        lowestPricePosition = pricePosition;
      }

      if (
        highestPricePosition === null ||
        item.price > highestPricePosition.price
      ) {
        highestPricePosition = pricePosition;
      }
    });
  });

  const products = Array.from(productStats.values()).map(
    ({ orderIds: _orderIds, ...item }) => ({
      ...item,
      total: roundMoney(item.total),
      averagePrice:
        item.quantity > 0
          ? roundMoney(item.total / item.quantity)
          : 0,
    }),
  );
  const suppliers = Array.from(supplierStats.values()).map((item) => ({
    ...item,
    total: roundMoney(item.total),
    paid: roundMoney(item.paid),
    outstanding: roundMoney(item.outstanding),
  }));
  const sortByQuantity = [...products].sort(
    (a, b) => b.quantity - a.quantity || b.total - a.total,
  );
  const sortByValue = [...products].sort(
    (a, b) => b.total - a.total || b.quantity - a.quantity,
  );
  const sortByFrequency = [...products].sort(
    (a, b) =>
      b.orderCount - a.orderCount ||
      b.lineCount - a.lineCount ||
      b.total - a.total,
  );

  return {
    orderCount: orders.length,
    totalValue: roundMoney(totalValue),
    paidAmount: roundMoney(paidAmount),
    outstandingAmount: roundMoney(Math.max(totalValue - paidAmount, 0)),
    totalQuantity,
    averageOrderValue:
      orders.length > 0 ? roundMoney(totalValue / orders.length) : 0,
    paymentCoveragePercent:
      totalValue > 0 ? roundMoney((paidAmount / totalValue) * 100) : 0,
    cancelledUnavailableRate:
      orders.length > 0
        ? roundMoney((cancelledUnavailableCount / orders.length) * 100)
        : 0,
    stockedRate:
      orders.length > 0 ? roundMoney((stockedCount / orders.length) * 100) : 0,
    overdueCount,
    lateRiskCount,
    topProductsByQuantity: sortByQuantity.slice(0, 5),
    topProductsByValue: sortByValue.slice(0, 5),
    topProductsByFrequency: sortByFrequency.slice(0, 5),
    productPriceRanges: [...products]
      .filter((item) => item.minPrice !== item.maxPrice)
      .sort((a, b) => b.maxPrice - b.minPrice - (a.maxPrice - a.minPrice))
      .slice(0, 5),
    topSuppliersBySpend: [...suppliers]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    topSuppliersByPending: [...suppliers]
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5),
    lowestPricePosition,
    highestPricePosition,
  };
};

