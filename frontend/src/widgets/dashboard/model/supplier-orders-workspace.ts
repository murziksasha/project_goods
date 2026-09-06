import type {
  SupplierOrder,
  SupplierOrderItem,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import i18n from '../../../shared/i18n/config';
import {
  buildSupplierOrderItemNumber,
  getSupplierOrderDisplayNumber,
} from './supplier-order-utils';

export type OrdersTab =
  | 'orders'
  | 'kanban'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';

export const supplierOrderTabs: Array<{ key: OrdersTab; labelKey: string }> = [
  { key: 'orders', labelKey: 'orders.tabs.orders' },
  { key: 'kanban', labelKey: 'orders.tabs.kanban' },
  { key: 'sales', labelKey: 'orders.tabs.sales' },
  { key: 'supplierOrders', labelKey: 'orders.tabs.supplierOrders' },
  { key: 'supplierInformation', labelKey: 'orders.tabs.supplierInformation' },
];

export const supplierOrderStatuses: Array<{
  key: SupplierOrderStatus;
  labelKey: string;
}> = [
  { key: 'request', labelKey: 'orders.supplier.orderStatuses.request' },
  { key: 'ordered', labelKey: 'orders.supplier.orderStatuses.ordered' },
  { key: 'approved', labelKey: 'orders.supplier.orderStatuses.approved' },
  {
    key: 'partially_stocked',
    labelKey: 'orders.supplier.orderStatuses.partially_stocked',
  },
  {
    key: 'partially_completed',
    labelKey: 'orders.supplier.orderStatuses.partially_completed',
  },
  { key: 'stocked', labelKey: 'orders.supplier.orderStatuses.stocked' },
  { key: 'overdue', labelKey: 'orders.supplier.orderStatuses.overdue' },
  { key: 'cancelled', labelKey: 'orders.supplier.orderStatuses.cancelled' },
  { key: 'unavailable', labelKey: 'orders.supplier.orderStatuses.unavailable' },
];

export const autoOnlySupplierOrderStatuses: SupplierOrderStatus[] = [
  'overdue',
  'partially_stocked',
  'partially_completed',
];

export const manualSupplierOrderStatuses = supplierOrderStatuses.filter(
  (status) => !autoOnlySupplierOrderStatuses.includes(status.key),
);

export const supplierPaymentStatuses: Array<{
  key: SupplierPaymentStatus;
  labelKey: string;
}> = [
  { key: 'pending', labelKey: 'orders.supplier.paymentStatuses.pending' },
  { key: 'paid', labelKey: 'orders.supplier.paymentStatuses.paid' },
  {
    key: 'without_payment',
    labelKey: 'orders.supplier.paymentStatuses.without_payment',
  },
  { key: 'cancelled', labelKey: 'orders.supplier.paymentStatuses.cancelled' },
];

export const supplierOrdersFiltersStorageKey =
  'project-goods.supplier-orders-filters';
export const supplierOrdersColumnsStorageKey =
  'project-goods.supplier-orders-columns';

const getDateLocale = () => (i18n.language?.startsWith('uk') ? 'uk-UA' : 'en-US');

const supplierOrderDateFormatter = new Intl.DateTimeFormat(getDateLocale(), {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const getSupplierOrderStatusClass = (status: SupplierOrderStatus) =>
  `supplier-order-status-badge supplier-order-status-${status}`;

export const getSupplierPaymentStatusClass = (
  status: SupplierPaymentStatus,
) => `supplier-payment-status-badge supplier-payment-status-${status}`;

export const getSupplierOrderStatusLabel = (status: SupplierOrderStatus) => {
  const labelKey = supplierOrderStatuses.find((item) => item.key === status)?.labelKey;
  return labelKey ? i18n.t(labelKey) : status;
};

export const getSupplierPaymentStatusLabel = (
  status: SupplierPaymentStatus,
) => {
  const labelKey = supplierPaymentStatuses.find((item) => item.key === status)?.labelKey;
  return labelKey ? i18n.t(labelKey) : status;
};

export const formatSupplierOrderDate = (value: string) =>
  supplierOrderDateFormatter.format(new Date(value));

export const formatPercent = (value: number) =>
  `${value.toFixed(value % 1 === 0 ? 0 : 2)}%`;

export type SupplierOrdersColumnKey =
  | 'number'
  | 'product'
  | 'quantity'
  | 'price'
  | 'total'
  | 'paid'
  | 'supplier'
  | 'createdAt'
  | 'createdBy'
  | 'deliveryDate'
  | 'status'
  | 'paymentStatus';

export type SupplierOrdersDateField = 'delivery' | 'created';

export const supplierOrdersAllColumns: SupplierOrdersColumnKey[] = [
  'number',
  'product',
  'quantity',
  'price',
  'total',
  'paid',
  'supplier',
  'createdAt',
  'createdBy',
  'deliveryDate',
  'status',
  'paymentStatus',
];

export const supplierOrdersDefaultColumns: SupplierOrdersColumnKey[] = [
  'number',
  'product',
  'quantity',
  'price',
  'total',
  'paid',
  'supplier',
  'createdAt',
  'status',
  'paymentStatus',
];

export const supplierOrdersLockedColumns: SupplierOrdersColumnKey[] = [
  'number',
];

export const getSupplierOrdersColumnLabel = (
  columnKey: SupplierOrdersColumnKey,
) => i18n.t(`orders.supplier.columns.${columnKey}`);

export const closedSupplierOrderStatuses: SupplierOrderStatus[] = [
  'stocked',
  'cancelled',
  'unavailable',
  'partially_completed',
];

const supplierOrderStatusKeys = supplierOrderStatuses.map((item) => item.key);

export type SupplierOrdersFilters = {
  query: string;
  selectedStatuses: SupplierOrderStatus[];
  paymentStatuses: SupplierPaymentStatus[];
  supplierId: string;
  createdBy: string;
  product: string;
  orderNumber: string;
  dateFrom: string;
  dateTo: string;
  dateField: SupplierOrdersDateField;
  favoritesOnly: boolean;
};

export const emptySupplierOrdersFilters: SupplierOrdersFilters = {
  query: '',
  selectedStatuses: [],
  paymentStatuses: [],
  supplierId: '',
  createdBy: '',
  product: '',
  orderNumber: '',
  dateFrom: '',
  dateTo: '',
  dateField: 'delivery',
  favoritesOnly: false,
};

const isPaymentStatus = (value: unknown): value is SupplierPaymentStatus =>
  value === 'pending' ||
  value === 'paid' ||
  value === 'without_payment' ||
  value === 'cancelled';

const isSupplierOrderStatus = (value: unknown): value is SupplierOrderStatus =>
  typeof value === 'string' &&
  supplierOrderStatusKeys.includes(value as SupplierOrderStatus);

const isDateField = (value: unknown): value is SupplierOrdersDateField =>
  value === 'delivery' || value === 'created';

const asTrimmedString = (value: unknown) =>
  typeof value === 'string' ? value : '';

export const parseSupplierOrdersFilters = (
  value: string | null | Record<string, unknown>,
): SupplierOrdersFilters => {
  try {
    const parsed = (
      typeof value === 'string' || value == null
        ? (JSON.parse(value ?? '{}') as Record<string, unknown>)
        : value
    ) as Partial<SupplierOrdersFilters> & {
      paymentStatus?: unknown;
      deliveryDate?: unknown;
      deliveryDateFrom?: unknown;
      deliveryDateTo?: unknown;
    };

    const selectedStatuses = Array.isArray(parsed.selectedStatuses)
      ? parsed.selectedStatuses.filter(isSupplierOrderStatus)
      : [];

    let paymentStatuses: SupplierPaymentStatus[] = [];
    if (Array.isArray(parsed.paymentStatuses)) {
      paymentStatuses = parsed.paymentStatuses.filter(isPaymentStatus);
    } else if (isPaymentStatus(parsed.paymentStatus)) {
      paymentStatuses = [parsed.paymentStatus];
    }

    return {
      query: asTrimmedString(parsed.query),
      selectedStatuses,
      paymentStatuses,
      supplierId: asTrimmedString(parsed.supplierId),
      createdBy: asTrimmedString(parsed.createdBy),
      product: asTrimmedString(parsed.product),
      orderNumber: asTrimmedString(parsed.orderNumber),
      dateFrom:
        asTrimmedString(parsed.dateFrom) ||
        asTrimmedString(parsed.deliveryDateFrom) ||
        asTrimmedString(parsed.deliveryDate),
      dateTo:
        asTrimmedString(parsed.dateTo) ||
        asTrimmedString(parsed.deliveryDateTo) ||
        asTrimmedString(parsed.deliveryDate),
      dateField: isDateField(parsed.dateField) ? parsed.dateField : 'delivery',
      favoritesOnly: parsed.favoritesOnly === true,
    };
  } catch {
    return { ...emptySupplierOrdersFilters };
  }
};

export const normalizeSupplierOrdersColumns = (
  value: string | null,
): SupplierOrdersColumnKey[] => {
  try {
    const parsed = JSON.parse(value ?? '[]') as SupplierOrdersColumnKey[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return supplierOrdersDefaultColumns;
    }

    const normalized = supplierOrdersAllColumns.filter((key) =>
      parsed.includes(key),
    );
    return normalized.length > 0 ? normalized : supplierOrdersDefaultColumns;
  } catch {
    return supplierOrdersDefaultColumns;
  }
};

export const areAllSupplierOrderItemsCancelled = (order: SupplierOrder) =>
  order.items.length > 0 &&
  order.items.every((item) => item.receiptStatus === 'cancelled');

export const isSupplierOrderHiddenFromList = (
  order: SupplierOrder,
  filters: SupplierOrdersFilters,
) => {
  if (order.paymentStatus !== 'pending') {
    return false;
  }
  if (!areAllSupplierOrderItemsCancelled(order)) {
    return false;
  }
  return !filters.selectedStatuses.includes('cancelled');
};

/** Empty selection = all statuses; non-empty = exact allow-list match. */
export const matchesSupplierOrderStatusFilter = (
  orderStatus: SupplierOrderStatus,
  selectedStatuses: SupplierOrderStatus[],
) => {
  if (selectedStatuses.length === 0) {
    return true;
  }
  return selectedStatuses.includes(orderStatus);
};

export const getSupplierOrderDateKey = (
  order: Pick<SupplierOrder, 'createdAt' | 'deliveryDate'>,
  dateField: SupplierOrdersDateField,
) =>
  (dateField === 'created' ? order.createdAt : order.deliveryDate).slice(0, 10);

export const toKievDateKey = (date: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kiev',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const isSupplierOrderPaidAmountUnpaid = (
  order: Pick<SupplierOrder, 'paymentStatus' | 'total' | 'paid'>,
) => order.paymentStatus === 'pending' && order.total - order.paid > 0;

export const isSupplierOrderDeliveryOverdue = (
  order: Pick<SupplierOrder, 'deliveryDate' | 'status'>,
  now: Date = new Date(),
) => {
  if (closedSupplierOrderStatuses.includes(order.status)) {
    return false;
  }
  const deliveryDay = order.deliveryDate.slice(0, 10);
  if (!deliveryDay) return false;
  return deliveryDay < toKievDateKey(now);
};

export const filterSupplierOrders = (
  orders: SupplierOrder[],
  filters: SupplierOrdersFilters,
) => {
  const normalized = filters.query.trim().toLowerCase();
  const orderNumber = filters.orderNumber.trim().toLowerCase();
  const productQuery = filters.product.trim().toLowerCase();
  const createdBy = filters.createdBy.trim().toLowerCase();

  return orders.filter((order) => {
    if (isSupplierOrderHiddenFromList(order, filters)) {
      return false;
    }

    if (filters.favoritesOnly && order.isFavorite !== true) {
      return false;
    }

    if (normalized) {
      const matchesNumber =
        order.number.toLowerCase().includes(normalized) ||
        order.orderBaseId.toLowerCase().includes(normalized);
      const matchesProduct = order.items.some((item) =>
        item.productName.toLowerCase().includes(normalized),
      );
      const matchesSupplier = order.supplierName
        .toLowerCase()
        .includes(normalized);
      const matchesCreatedBy = order.createdBy.toLowerCase().includes(normalized);
      const matchesNote = order.note.toLowerCase().includes(normalized);

      if (
        !matchesNumber &&
        !matchesProduct &&
        !matchesSupplier &&
        !matchesCreatedBy &&
        !matchesNote
      ) {
        return false;
      }
    }

    if (orderNumber) {
      const matchesDedicatedNumber =
        order.number.toLowerCase().includes(orderNumber) ||
        order.orderBaseId.toLowerCase().includes(orderNumber);
      if (!matchesDedicatedNumber) {
        return false;
      }
    }

    if (productQuery) {
      const matchesDedicatedProduct = order.items.some((item) =>
        item.productName.toLowerCase().includes(productQuery),
      );
      if (!matchesDedicatedProduct) {
        return false;
      }
    }

    if (filters.supplierId && order.supplierId !== filters.supplierId) {
      return false;
    }

    if (createdBy && order.createdBy.toLowerCase() !== createdBy) {
      return false;
    }

    if (
      !matchesSupplierOrderStatusFilter(order.status, filters.selectedStatuses)
    ) {
      return false;
    }

    if (
      filters.paymentStatuses.length > 0 &&
      !filters.paymentStatuses.includes(order.paymentStatus)
    ) {
      return false;
    }

    const orderDate = getSupplierOrderDateKey(order, filters.dateField);
    if (filters.dateFrom && orderDate < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && orderDate > filters.dateTo) {
      return false;
    }

    return true;
  });
};

export const getActiveSupplierOrdersFiltersCount = (
  filters: SupplierOrdersFilters,
) =>
  filters.selectedStatuses.length +
  filters.paymentStatuses.length +
  (filters.supplierId ? 1 : 0) +
  (filters.createdBy.trim() ? 1 : 0) +
  (filters.product.trim() ? 1 : 0) +
  (filters.orderNumber.trim() ? 1 : 0) +
  (filters.dateFrom ? 1 : 0) +
  (filters.dateTo ? 1 : 0) +
  (filters.dateField !== 'delivery' && (filters.dateFrom || filters.dateTo)
    ? 1
    : 0) +
  (filters.favoritesOnly ? 1 : 0);

export type SupplierOrdersFilterChip = {
  id: string;
  label: string;
  clear: (current: SupplierOrdersFilters) => SupplierOrdersFilters;
};

const clearFilterField =
  <K extends keyof SupplierOrdersFilters>(
    key: K,
    value: SupplierOrdersFilters[K],
  ) =>
  (current: SupplierOrdersFilters): SupplierOrdersFilters => ({
    ...current,
    [key]: value,
  });

export const buildSupplierOrdersFilterChips = (
  filters: SupplierOrdersFilters,
  labels: {
    status: (status: SupplierOrderStatus) => string;
    payment: (status: SupplierPaymentStatus) => string;
    supplier: (id: string) => string;
    createdBy: string;
    product: string;
    orderNumber: string;
    dateFrom: string;
    dateTo: string;
    dateFieldCreated: string;
    query: string;
    favorites: string;
  },
): SupplierOrdersFilterChip[] => {
  const chips: SupplierOrdersFilterChip[] = [];

  for (const status of filters.selectedStatuses) {
    chips.push({
      id: `status-${status}`,
      label: labels.status(status),
      clear: (current) => ({
        ...current,
        selectedStatuses: current.selectedStatuses.filter(
          (item) => item !== status,
        ),
      }),
    });
  }

  for (const payment of filters.paymentStatuses) {
    chips.push({
      id: `payment-${payment}`,
      label: labels.payment(payment),
      clear: (current) => ({
        ...current,
        paymentStatuses: current.paymentStatuses.filter(
          (item) => item !== payment,
        ),
      }),
    });
  }

  if (filters.supplierId) {
    chips.push({
      id: 'supplierId',
      label: labels.supplier(filters.supplierId),
      clear: clearFilterField('supplierId', ''),
    });
  }

  if (filters.createdBy.trim()) {
    chips.push({
      id: 'createdBy',
      label: `${labels.createdBy}: ${filters.createdBy.trim()}`,
      clear: clearFilterField('createdBy', ''),
    });
  }

  if (filters.product.trim()) {
    chips.push({
      id: 'product',
      label: `${labels.product}: ${filters.product.trim()}`,
      clear: clearFilterField('product', ''),
    });
  }

  if (filters.orderNumber.trim()) {
    chips.push({
      id: 'orderNumber',
      label: `${labels.orderNumber}: ${filters.orderNumber.trim()}`,
      clear: clearFilterField('orderNumber', ''),
    });
  }

  if (filters.dateFrom) {
    chips.push({
      id: 'dateFrom',
      label: `${labels.dateFrom}: ${filters.dateFrom}`,
      clear: clearFilterField('dateFrom', ''),
    });
  }

  if (filters.dateTo) {
    chips.push({
      id: 'dateTo',
      label: `${labels.dateTo}: ${filters.dateTo}`,
      clear: clearFilterField('dateTo', ''),
    });
  }

  if (filters.dateField === 'created' && (filters.dateFrom || filters.dateTo)) {
    chips.push({
      id: 'dateField',
      label: labels.dateFieldCreated,
      clear: clearFilterField('dateField', 'delivery'),
    });
  }

  if (filters.query.trim()) {
    chips.push({
      id: 'query',
      label: `${labels.query}: ${filters.query.trim()}`,
      clear: clearFilterField('query', ''),
    });
  }

  if (filters.favoritesOnly) {
    chips.push({
      id: 'favoritesOnly',
      label: labels.favorites,
      clear: clearFilterField('favoritesOnly', false),
    });
  }

  return chips;
};

export const summarizeFilteredSupplierOrders = (orders: SupplierOrder[]) => {
  let pcs = 0;
  let total = 0;
  let paid = 0;

  for (const order of orders) {
    pcs += order.items.reduce((sum, item) => sum + item.quantity, 0);
    total += order.total;
    paid += order.paid;
  }

  return {
    orderCount: orders.length,
    pcs,
    total,
    paid,
    outstanding: Math.max(0, total - paid),
  };
};

export const paginateSupplierOrders = (
  orders: SupplierOrder[],
  page: number,
  pageSize: number,
) => {
  const start = (page - 1) * pageSize;
  return orders.slice(start, start + pageSize);
};

export type SupplierOrderTableRow =
  | {
      kind: 'single';
      id: string;
      order: SupplierOrder;
      item: SupplierOrderItem;
    }
  | {
      kind: 'parent';
      id: string;
      order: SupplierOrder;
    }
  | {
      kind: 'child';
      id: string;
      label: string;
      order: SupplierOrder;
      item: SupplierOrderItem;
    };

export const buildSupplierOrderChildRowLabel = (itemIndex: number) =>
  String(itemIndex + 1);

export const isMultiItemSupplierOrder = (order: SupplierOrder) =>
  order.items.length >= 2;

export const getActiveSupplierOrderItems = (order: SupplierOrder) =>
  order.items.filter(
    (item) =>
      item.receiptStatus !== 'received' && item.receiptStatus !== 'cancelled',
  );

export const summarizeSupplierOrderItems = (order: SupplierOrder) => ({
  count: order.items.length,
  totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
});

export const buildSupplierOrderTableRows = (
  order: SupplierOrder,
  expandedOrderIds: ReadonlySet<string>,
): SupplierOrderTableRow[] => {
  if (order.items.length <= 1) {
    const item = order.items[0];
    if (!item) {
      return [];
    }

    return [
      {
        kind: 'single',
        id: getSupplierOrderDisplayNumber(order),
        order,
        item,
      },
    ];
  }

  const parentId = getSupplierOrderDisplayNumber(order);
  const rows: SupplierOrderTableRow[] = [
    {
      kind: 'parent',
      id: parentId,
      order,
    },
  ];

  if (expandedOrderIds.has(order.id)) {
    order.items.forEach((item) => {
      rows.push({
        kind: 'child',
        id: `${order.id}-item-${item.itemIndex}`,
        label: buildSupplierOrderChildRowLabel(item.itemIndex),
        order,
        item,
      });
    });
  }

  return rows;
};

/** @deprecated Use buildSupplierOrderTableRows instead */
export const buildGroupedSupplierOrderView = (order: SupplierOrder) =>
  order.items.map((item) => ({
    id: buildSupplierOrderItemNumber(order, item.itemIndex),
    item,
    order,
  }));

export const SUPPLIER_ORDER_STATUS_MENU_WIDTH = 210;
export const SUPPLIER_ORDER_STATUS_MENU_MAX_HEIGHT = 220;
export const SUPPLIER_ORDER_STATUS_MENU_GAP = 4;
export const SUPPLIER_ORDER_STATUS_MENU_VIEWPORT_PADDING = 8;
export const SUPPLIER_ORDER_STATUS_MENU_MIN_HEIGHT = 120;

export type SupplierOrderStatusMenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'below' | 'above';
};

export const computeSupplierOrderStatusMenuPosition = (
  anchorRect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'width'>,
  viewport: { width: number; height: number } = {
    width: window.innerWidth,
    height: window.innerHeight,
  },
): SupplierOrderStatusMenuPosition => {
  const menuWidth = SUPPLIER_ORDER_STATUS_MENU_WIDTH;
  const menuMaxHeight = SUPPLIER_ORDER_STATUS_MENU_MAX_HEIGHT;
  const gap = SUPPLIER_ORDER_STATUS_MENU_GAP;
  const pad = SUPPLIER_ORDER_STATUS_MENU_VIEWPORT_PADDING;

  const spaceBelow = viewport.height - anchorRect.bottom - gap - pad;
  const spaceAbove = anchorRect.top - gap - pad;
  const openBelow = spaceBelow >= spaceAbove;
  const availableSpace = openBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(
    SUPPLIER_ORDER_STATUS_MENU_MIN_HEIGHT,
    Math.min(menuMaxHeight, availableSpace),
  );

  let top = openBelow
    ? anchorRect.bottom + gap
    : anchorRect.top - gap - maxHeight;
  top = Math.max(pad, Math.min(top, viewport.height - pad - maxHeight));

  let left = anchorRect.left;
  left = Math.max(pad, Math.min(left, viewport.width - menuWidth - pad));

  return {
    top,
    left,
    maxHeight,
    placement: openBelow ? 'below' : 'above',
  };
};