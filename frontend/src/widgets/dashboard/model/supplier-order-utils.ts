import type { Supplier } from '../../../entities/supplier/model/types';
import i18n from '../../../shared/i18n/config';
import type {
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderStatus,
  SupplierPaymentStatus,
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

export const SUPPLIER_ORDER_PAYABLE_STATUSES: readonly SupplierOrderStatus[] = [
  'approved',
  'overdue',
  'partially_stocked',
  'partially_completed',
  'stocked',
];

export const isSupplierOrderPayable = (
  order: Pick<SupplierOrder, 'status' | 'paymentStatus' | 'total'>,
) =>
  order.paymentStatus === 'pending' &&
  order.total > 0 &&
  SUPPLIER_ORDER_PAYABLE_STATUSES.includes(order.status);

export const isSupplierOrderPaid = (
  order: Pick<SupplierOrder, 'paymentStatus'>,
) => order.paymentStatus === 'paid';

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
  'Замовлення вже сплачено.': 'orders.supplier.messages.errors.alreadyPaid',
  'Замовлення вже видано без оплати.':
    'orders.supplier.messages.errors.alreadyIssuedWithoutPayment',
  'Оплата доступна тільки для замовлень зі статусом approved або stocked.':
    'orders.supplier.messages.errors.payStatusNotAllowed',
  'Видача без оплати доступна тільки для замовлень зі статусом approved або stocked.':
    'orders.supplier.messages.errors.issueWithoutPaymentStatusNotAllowed',
  'Cashbox balance is not enough for this operation.':
    'orders.supplier.messages.errors.cashboxBalanceNotEnough',
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

export type SupplierOrderStatusBreakdown = {
  status: SupplierOrderStatus;
  count: number;
  value: number;
};

export type SupplierOrderPaymentBreakdown = {
  status: SupplierPaymentStatus;
  count: number;
  amount: number;
};

export type SupplierOrderSpendPoint = {
  key: string;
  label: string;
  value: number;
  orderCount: number;
};

export type SupplierOrderPreviousWindow = {
  totalValue: number;
  paidAmount: number;
  orderCount: number;
  deltas: {
    totalValuePct: number | null;
    paidAmountPct: number | null;
    orderCountPct: number | null;
  };
};

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
  overdueOutstanding: number;
  openPipelineValue: number;
  openPipelineCount: number;
  averageLeadDays: number | null;
  supplierConcentrationPercent: number;
  statusBreakdown: SupplierOrderStatusBreakdown[];
  paymentBreakdown: SupplierOrderPaymentBreakdown[];
  spendSeries: SupplierOrderSpendPoint[];
  previousWindow: SupplierOrderPreviousWindow | null;
  topProductsByQuantity: SupplierOrderProductStat[];
  topProductsByValue: SupplierOrderProductStat[];
  topProductsByFrequency: SupplierOrderProductStat[];
  productPriceRanges: SupplierOrderProductStat[];
  topSuppliersBySpend: SupplierOrderSupplierStat[];
  topSuppliersByPending: SupplierOrderSupplierStat[];
  lowestPricePosition: SupplierOrderPricePosition;
  highestPricePosition: SupplierOrderPricePosition;
};

export const supplierOrderAnalyticsStatuses: SupplierOrderStatus[] = [
  'request',
  'ordered',
  'approved',
  'partially_stocked',
  'partially_completed',
  'stocked',
  'overdue',
  'cancelled',
  'unavailable',
];

export const supplierOrderAnalyticsPayments: SupplierPaymentStatus[] = [
  'pending',
  'paid',
  'without_payment',
  'cancelled',
];

export type SupplierOrderAnalyticsOptions = {
  previousOrders?: SupplierOrder[];
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toIsoDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getPreviousDeliveryDateRange = (
  dateFrom: string,
  dateTo: string,
  currentDate: Date = new Date(),
): { dateFrom: string; dateTo: string } | null => {
  const today = toIsoDateKey(
    new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
    ),
  );
  const from = dateFrom.trim();
  const to = dateTo.trim() || (from ? today : '');
  const start = from || to;
  const end = to || from;
  if (!start || !end) return null;

  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }
  const first = startDate <= endDate ? startDate : endDate;
  const last = startDate <= endDate ? endDate : startDate;
  const spanDays = Math.max(
    1,
    Math.floor((last.getTime() - first.getTime()) / MS_PER_DAY) + 1,
  );
  const prevEnd = new Date(first);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - spanDays + 1);
  return {
    dateFrom: toIsoDateKey(prevStart),
    dateTo: toIsoDateKey(prevEnd),
  };
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

const percentDelta = (current: number, previous: number) =>
  previous > 0 ? roundMoney(((current - previous) / previous) * 100) : null;

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

const isPipelineClosed = (order: SupplierOrder) =>
  order.status === 'stocked' ||
  order.status === 'partially_completed' ||
  order.status === 'cancelled' ||
  order.status === 'unavailable' ||
  order.receiptStatus === 'received';

const isLeadTimeCompleted = (order: SupplierOrder) =>
  order.status === 'stocked' ||
  order.status === 'partially_completed' ||
  order.receiptStatus === 'received';

const summarizeOrdersMoney = (orders: SupplierOrder[]) => {
  let totalValue = 0;
  let paidAmount = 0;
  orders.forEach((order) => {
    const orderTotal = getOrderTotal(order);
    totalValue += orderTotal;
    paidAmount += Math.min(Math.max(order.paid, 0), orderTotal);
  });
  return {
    orderCount: orders.length,
    totalValue: roundMoney(totalValue),
    paidAmount: roundMoney(paidAmount),
  };
};

const buildSpendSeries = (
  orders: SupplierOrder[],
): SupplierOrderSpendPoint[] => {
  if (orders.length === 0) return [];

  const times = orders
    .map((order) => {
      const parsed = new Date(order.createdAt);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter((date): date is Date => date !== null);
  if (times.length === 0) return [];

  const minTime = Math.min(...times.map((date) => date.getTime()));
  const maxTime = Math.max(...times.map((date) => date.getTime()));
  const start = new Date(minTime);
  start.setHours(0, 0, 0, 0);
  const end = new Date(maxTime);
  end.setHours(0, 0, 0, 0);
  const daySpan =
    Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
  const locale = i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US';

  type Bucket = { key: string; label: string };
  const buckets: Bucket[] = [];
  if (daySpan <= 1) {
    const dayKey = toIsoDateKey(start);
    for (let hour = 0; hour < 24; hour += 1) {
      buckets.push({
        key: `${dayKey}T${String(hour).padStart(2, '0')}`,
        label: `${String(hour).padStart(2, '0')}:00`,
      });
    }
  } else if (daySpan <= 62) {
    const cursor = new Date(start);
    while (cursor <= end) {
      buckets.push({
        key: toIsoDateKey(cursor),
        label: cursor.toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
        }),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= endMonth) {
      buckets.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: cursor.toLocaleDateString(locale, {
          month: 'short',
          year: '2-digit',
        }),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const values = new Map(
    buckets.map((bucket) => [
      bucket.key,
      { value: 0, orderCount: 0, label: bucket.label },
    ]),
  );

  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    if (Number.isNaN(date.getTime())) return;
    let key: string;
    if (daySpan <= 1) {
      key = `${toIsoDateKey(date)}T${String(date.getHours()).padStart(2, '0')}`;
    } else if (daySpan <= 62) {
      key = toIsoDateKey(
        new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      );
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    const bucket = values.get(key);
    if (!bucket) return;
    bucket.value += getOrderTotal(order);
    bucket.orderCount += 1;
  });

  return buckets.map((bucket) => {
    const entry = values.get(bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      value: roundMoney(entry?.value ?? 0),
      orderCount: entry?.orderCount ?? 0,
    };
  });
};

export const buildSupplierOrderAnalytics = (
  orders: SupplierOrder[],
  currentDate: Date = new Date(),
  options?: SupplierOrderAnalyticsOptions,
): SupplierOrderAnalytics => {
  const productStats = new Map<
    string,
    SupplierOrderProductStat & { orderIds: Set<string> }
  >();
  const supplierStats = new Map<string, SupplierOrderSupplierStat>();
  const statusTotals = new Map<
    SupplierOrderStatus,
    { count: number; value: number }
  >();
  const paymentTotals = new Map<
    SupplierPaymentStatus,
    { count: number; amount: number }
  >();
  supplierOrderAnalyticsStatuses.forEach((status) => {
    statusTotals.set(status, { count: 0, value: 0 });
  });
  supplierOrderAnalyticsPayments.forEach((status) => {
    paymentTotals.set(status, { count: 0, amount: 0 });
  });
  let paidAmount = 0;
  let totalValue = 0;
  let totalQuantity = 0;
  let cancelledUnavailableCount = 0;
  let stockedCount = 0;
  let overdueCount = 0;
  let lateRiskCount = 0;
  let overdueOutstanding = 0;
  let openPipelineValue = 0;
  let openPipelineCount = 0;
  let leadDaysSum = 0;
  let leadSamples = 0;
  let lowestPricePosition: SupplierOrderPricePosition = null;
  let highestPricePosition: SupplierOrderPricePosition = null;
  const currentDateTime = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  ).getTime();
  const lateRiskWindowMs = 3 * MS_PER_DAY;

  orders.forEach((order) => {
    const orderTotal = getOrderTotal(order);
    const orderPaid = Math.min(Math.max(order.paid, 0), orderTotal);
    const outstanding = Math.max(orderTotal - orderPaid, 0);
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
    supplierEntry.outstanding += outstanding;
    supplierStats.set(supplierKey, supplierEntry);

    const statusEntry = statusTotals.get(order.status) ?? {
      count: 0,
      value: 0,
    };
    statusEntry.count += 1;
    statusEntry.value += orderTotal;
    statusTotals.set(order.status, statusEntry);

    const paymentEntry = paymentTotals.get(order.paymentStatus) ?? {
      count: 0,
      amount: 0,
    };
    paymentEntry.count += 1;
    paymentEntry.amount += orderTotal;
    paymentTotals.set(order.paymentStatus, paymentEntry);

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

    if (!isPipelineClosed(order)) {
      openPipelineCount += 1;
      openPipelineValue += orderTotal;
    }

    if (isLeadTimeCompleted(order)) {
      const created = toDateOnlyTime(order.createdAt);
      const updated = toDateOnlyTime(order.updatedAt);
      if (created !== null && updated !== null) {
        leadDaysSum += Math.max(0, (updated - created) / MS_PER_DAY);
        leadSamples += 1;
      }
    }

    const deliveryTime = toDateOnlyTime(order.deliveryDate);
    const isOpenOrder =
      order.status !== 'stocked' &&
      order.status !== 'partially_completed' &&
      order.status !== 'cancelled' &&
      order.status !== 'unavailable' &&
      order.status !== 'overdue' &&
      order.receiptStatus !== 'received';
    const isOverdueByDate =
      isOpenOrder && deliveryTime !== null && deliveryTime < currentDateTime;
    if (order.status === 'overdue' || isOverdueByDate) {
      overdueOutstanding += outstanding;
    }
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
  const topSuppliersBySpend = [...suppliers].sort(
    (a, b) => b.total - a.total,
  );
  const roundedTotalValue = roundMoney(totalValue);
  const roundedPaidAmount = roundMoney(paidAmount);
  const previousSummary =
    options?.previousOrders !== undefined
      ? summarizeOrdersMoney(options.previousOrders)
      : null;

  return {
    orderCount: orders.length,
    totalValue: roundedTotalValue,
    paidAmount: roundedPaidAmount,
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
    overdueOutstanding: roundMoney(overdueOutstanding),
    openPipelineValue: roundMoney(openPipelineValue),
    openPipelineCount,
    averageLeadDays:
      leadSamples > 0 ? roundMoney(leadDaysSum / leadSamples) : null,
    supplierConcentrationPercent:
      roundedTotalValue > 0 && topSuppliersBySpend[0]
        ? roundMoney((topSuppliersBySpend[0].total / roundedTotalValue) * 100)
        : 0,
    statusBreakdown: supplierOrderAnalyticsStatuses.map((status) => {
      const entry = statusTotals.get(status);
      return {
        status,
        count: entry?.count ?? 0,
        value: roundMoney(entry?.value ?? 0),
      };
    }),
    paymentBreakdown: supplierOrderAnalyticsPayments.map((status) => {
      const entry = paymentTotals.get(status);
      return {
        status,
        count: entry?.count ?? 0,
        amount: roundMoney(entry?.amount ?? 0),
      };
    }),
    spendSeries: buildSpendSeries(orders),
    previousWindow: previousSummary
      ? {
          ...previousSummary,
          deltas: {
            totalValuePct: percentDelta(
              roundedTotalValue,
              previousSummary.totalValue,
            ),
            paidAmountPct: percentDelta(
              roundedPaidAmount,
              previousSummary.paidAmount,
            ),
            orderCountPct: percentDelta(
              orders.length,
              previousSummary.orderCount,
            ),
          },
        }
      : null,
    topProductsByQuantity: sortByQuantity.slice(0, 5),
    topProductsByValue: sortByValue.slice(0, 5),
    topProductsByFrequency: sortByFrequency.slice(0, 5),
    productPriceRanges: [...products]
      .filter((item) => item.minPrice !== item.maxPrice)
      .sort((a, b) => b.maxPrice - b.minPrice - (a.maxPrice - a.minPrice))
      .slice(0, 5),
    topSuppliersBySpend: topSuppliersBySpend.slice(0, 5),
    topSuppliersByPending: [...suppliers]
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5),
    lowestPricePosition,
    highestPricePosition,
  };
};

