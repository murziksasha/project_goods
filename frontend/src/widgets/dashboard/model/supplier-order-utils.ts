import type { Supplier } from '../../../entities/supplier/model/types';
import i18n from '../../../shared/i18n/config';
import type {
  SupplierOrder,
  SupplierOrderItem,
  SupplierReceiptStatus,
} from '../../../entities/supplier-order/model/types';

export type SupplierOrderModalLocks = {
  isContentLocked: boolean;
  isTakeOnChargeLocked: boolean;
  isCancelLocked: boolean;
};

export type SupplierOrderModalLockInput = Pick<
  SupplierOrder,
  'status' | 'paymentStatus' | 'receiptStatus' | 'items'
>;

export type SupplierOrderModalLockOptions = {
  itemReceiptStatus?: SupplierReceiptStatus;
};

const isSupplierOrderFinalClosed = (order: SupplierOrderModalLockInput) =>
  order.status === 'cancelled' ||
  order.status === 'unavailable' ||
  order.paymentStatus === 'cancelled';

const isSupplierOrderFullyReceived = (order: SupplierOrderModalLockInput) =>
  (order.items.length > 0 &&
    order.items.every((item) => item.receiptStatus === 'received')) ||
  order.status === 'stocked' ||
  order.receiptStatus === 'received';

export const resolveSupplierOrderModalLocks = (
  order: SupplierOrderModalLockInput | null | undefined,
  options?: SupplierOrderModalLockOptions,
): SupplierOrderModalLocks => {
  if (!order) {
    return {
      isContentLocked: false,
      isTakeOnChargeLocked: false,
      isCancelLocked: false,
    };
  }

  const isFinalClosed = isSupplierOrderFinalClosed(order);
  const fullyReceived = isSupplierOrderFullyReceived(order);
  const itemReceiptStatus =
    options?.itemReceiptStatus ?? order.items[0]?.receiptStatus;
  const itemReceived = itemReceiptStatus === 'received';
  const itemCancelled = itemReceiptStatus === 'cancelled';

  const isTakeOnChargeLocked =
    isFinalClosed || fullyReceived || itemReceived || itemCancelled;
  const isContentLocked =
    isTakeOnChargeLocked ||
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'without_payment';
  const isCancelLocked =
    isFinalClosed ||
    fullyReceived ||
    order.paymentStatus === 'paid' ||
    order.paymentStatus === 'without_payment';

  return { isContentLocked, isTakeOnChargeLocked, isCancelLocked };
};

const supplierOrderBackendErrorMap: Record<string, string> = {
  'Оплачений заказ не можна редагувати.':
    'orders.supplier.messages.errors.paidNotEditable',
  'Оплачений заказ не можна скасувати.':
    'orders.supplier.messages.errors.paidNotCancellable',
  'Оприбутковане замовлення не можна скасувати.':
    'orders.supplier.messages.errors.receivedNotCancellable',
  'Замовлення вже скасовано.':
    'orders.supplier.messages.errors.alreadyCancelled',
  'Closed supplier order cannot be taken on charge.':
    'orders.supplier.messages.errors.closedNotReceivable',
  'Cancelled supplier order cannot be taken on charge.':
    'orders.supplier.messages.errors.closedNotReceivable',
  'Supplier order item is already received.':
    'orders.supplier.messages.errors.itemAlreadyReceived',
  'Cancelled supplier order item cannot be taken on charge.':
    'orders.supplier.messages.errors.itemCancelledNotReceivable',
  'Received supplier order item cannot be cancelled.':
    'orders.supplier.messages.errors.itemReceivedNotCancellable',
  'Supplier order item is already cancelled.':
    'orders.supplier.messages.errors.itemAlreadyCancelled',
};

export const resolveSupplierOrderErrorMessage = (
  error: unknown,
  translate: (key: string) => string,
  fallbackKey = 'orders.supplier.messages.errors.failedSave',
) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const translationKey = supplierOrderBackendErrorMap[message];
  if (translationKey) {
    return translate(translationKey);
  }
  if (message.trim()) {
    return message;
  }
  return translate(fallbackKey);
};

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

const supplierMatchesSearch = (supplier: Supplier, normalized: string) =>
  [
    supplier.name,
    supplier.phone,
    ...(supplier.phones?.length ? supplier.phones : []),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);

export const filterActiveSuppliers = (
  suppliers: Supplier[],
  searchValue: string,
) => {
  const normalized = searchValue.trim().toLowerCase();
  return suppliers.filter((supplier) => {
    if (!supplier.isActive) return false;
    if (!normalized) return true;
    return supplierMatchesSearch(supplier, normalized);
  });
};

export const getSupplierSuggestions = (
  suppliers: Supplier[],
  searchValue: string,
) => {
  const normalized = searchValue.trim().toLowerCase();
  if (normalized.length < 2) return [];
  return filterActiveSuppliers(suppliers, searchValue).slice(0, 8);
};

export const buildSupplierOrderItemNumber = (
  order: SupplierOrder,
  itemIndex: number,
) => {
  const baseNumber = getSupplierOrderDisplayNumber(order);
  if (order.items.length <= 1) {
    return baseNumber;
  }
  return `${baseNumber}-${itemIndex + 1}`;
};

export const getSupplierOrderDisplayNumber = (
  order: Pick<SupplierOrder, 'number' | 'orderBaseId' | 'id'>,
) => order.number || order.orderBaseId || order.id;

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
        supplierName:
          order.supplierName || i18n.t('orders.supplier.fallbacks.unknownSupplier'),
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

    if (
      order.status === 'stocked' ||
      order.status === 'partially_stocked' ||
      order.status === 'partially_completed' ||
      order.receiptStatus === 'received'
    ) {
      stockedCount += 1;
    }

    const deliveryTime = toDateOnlyTime(order.deliveryDate);
    const isOpenOrder =
      order.status !== 'stocked' &&
      order.status !== 'partially_completed' &&
      order.status !== 'cancelled' &&
      order.status !== 'unavailable' &&
      order.status !== 'overdue' &&
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
          productName:
            item.productName || i18n.t('orders.supplier.fallbacks.unnamedProduct'),
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

  const products = Array.from(productStats.values()).map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    total: roundMoney(item.total),
    lineCount: item.lineCount,
    orderCount: item.orderCount,
    minPrice: item.minPrice,
    maxPrice: item.maxPrice,
    averagePrice:
      item.quantity > 0
        ? roundMoney(item.total / item.quantity)
        : 0,
  }));
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

