import type {
  SupplierOrder,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import i18n from '../../../shared/i18n/config';
import { buildSupplierOrderItemNumber } from './supplier-order-utils';

export type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';

export const supplierOrderTabs: Array<{ key: OrdersTab; labelKey: string }> = [
  { key: 'orders', labelKey: 'orders.tabs.orders' },
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
  { key: 'stocked', labelKey: 'orders.supplier.orderStatuses.stocked' },
  { key: 'overdue', labelKey: 'orders.supplier.orderStatuses.overdue' },
  { key: 'cancelled', labelKey: 'orders.supplier.orderStatuses.cancelled' },
  { key: 'unavailable', labelKey: 'orders.supplier.orderStatuses.unavailable' },
];

export const manualSupplierOrderStatuses = supplierOrderStatuses.filter(
  (status) => status.key !== 'overdue',
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
  | 'deliveryDate'
  | 'status'
  | 'paymentStatus';

export const supplierOrdersAllColumns: SupplierOrdersColumnKey[] = [
  'number',
  'product',
  'quantity',
  'price',
  'total',
  'paid',
  'supplier',
  'deliveryDate',
  'status',
  'paymentStatus',
];

export const supplierOrdersLockedColumns: SupplierOrdersColumnKey[] = [
  'number',
];

export const getSupplierOrdersColumnLabel = (
  columnKey: SupplierOrdersColumnKey,
) => i18n.t(`orders.supplier.columns.${columnKey}`);

export type SupplierOrdersFilters = {
  query: string;
  selectedStatuses: SupplierOrderStatus[];
  paymentStatus: SupplierPaymentStatus | 'all';
  deliveryDateFrom: string;
  deliveryDateTo: string;
  favoritesOnly: boolean;
};

const isPaymentStatusFilter = (
  value: unknown,
): value is SupplierPaymentStatus | 'all' =>
  value === 'pending' ||
  value === 'paid' ||
  value === 'without_payment' ||
  value === 'cancelled' ||
  value === 'all';

export const parseSupplierOrdersFilters = (
  value: string | null,
): SupplierOrdersFilters => {
  try {
    const parsed = JSON.parse(value ?? '{}') as Partial<
      SupplierOrdersFilters & { deliveryDate: string }
    >;

    return {
      query: parsed.query ?? '',
      selectedStatuses: Array.isArray(parsed.selectedStatuses)
        ? parsed.selectedStatuses
        : [],
      paymentStatus: isPaymentStatusFilter(parsed.paymentStatus)
        ? parsed.paymentStatus
        : 'all',
      deliveryDateFrom: parsed.deliveryDateFrom ?? parsed.deliveryDate ?? '',
      deliveryDateTo: parsed.deliveryDateTo ?? parsed.deliveryDate ?? '',
      favoritesOnly: parsed.favoritesOnly === true,
    };
  } catch {
    return {
      query: '',
      selectedStatuses: [],
      paymentStatus: 'all',
      deliveryDateFrom: '',
      deliveryDateTo: '',
      favoritesOnly: false,
    };
  }
};

export const normalizeSupplierOrdersColumns = (
  value: string | null,
): SupplierOrdersColumnKey[] => {
  try {
    const parsed = JSON.parse(value ?? '[]') as SupplierOrdersColumnKey[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return supplierOrdersAllColumns;
    }

    const normalized = supplierOrdersAllColumns.filter((key) =>
      parsed.includes(key),
    );
    return normalized.length > 0 ? normalized : supplierOrdersAllColumns;
  } catch {
    return supplierOrdersAllColumns;
  }
};

export const filterSupplierOrders = (
  orders: SupplierOrder[],
  filters: SupplierOrdersFilters,
) => {
  const normalized = filters.query.trim().toLowerCase();

  return orders.filter((order) => {
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

      if (!matchesNumber && !matchesProduct && !matchesSupplier) {
        return false;
      }
    }

    if (
      filters.selectedStatuses.length > 0 &&
      !filters.selectedStatuses.includes(order.status)
    ) {
      return false;
    }

    if (
      filters.paymentStatus !== 'all' &&
      order.paymentStatus !== filters.paymentStatus
    ) {
      return false;
    }

    const orderDate = order.deliveryDate.slice(0, 10);
    if (filters.deliveryDateFrom && orderDate < filters.deliveryDateFrom) {
      return false;
    }
    if (filters.deliveryDateTo && orderDate > filters.deliveryDateTo) {
      return false;
    }

    return true;
  });
};

export const paginateSupplierOrders = (
  orders: SupplierOrder[],
  page: number,
  pageSize: number,
) => {
  const start = (page - 1) * pageSize;
  return orders.slice(start, start + pageSize);
};

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