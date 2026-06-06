import type {
  SupplierOrder,
  SupplierOrderStatus,
  SupplierPaymentStatus,
} from '../../../entities/supplier-order/model/types';
import { buildSupplierOrderItemNumber } from './supplier-order-utils';

export type OrdersTab =
  | 'orders'
  | 'sales'
  | 'supplierOrders'
  | 'supplierInformation';

export const supplierOrderTabs: Array<{ key: OrdersTab; label: string }> = [
  { key: 'orders', label: 'Orders' },
  { key: 'sales', label: 'Sales' },
  { key: 'supplierOrders', label: 'Supplier Order' },
  { key: 'supplierInformation', label: 'Information' },
];

export const supplierOrderStatuses: Array<{
  key: SupplierOrderStatus;
  label: string;
}> = [
  { key: 'request', label: 'Purchase request' },
  { key: 'ordered', label: 'Ordered' },
  { key: 'approved', label: 'Approved' },
  { key: 'stocked', label: 'Stocked' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'unavailable', label: 'Unavailable' },
];

export const supplierPaymentStatuses: Array<{
  key: SupplierPaymentStatus;
  label: string;
}> = [
  { key: 'pending', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
  { key: 'without_payment', label: 'Issued without payment' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const supplierOrdersFiltersStorageKey =
  'project-goods.supplier-orders-filters';
export const supplierOrdersColumnsStorageKey =
  'project-goods.supplier-orders-columns';

const supplierOrderDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const getSupplierOrderStatusClass = (status: SupplierOrderStatus) =>
  `supplier-order-status-badge supplier-order-status-${status}`;

export const getSupplierPaymentStatusClass = (
  status: SupplierPaymentStatus,
) => `supplier-payment-status-badge supplier-payment-status-${status}`;

export const getSupplierOrderStatusLabel = (status: SupplierOrderStatus) =>
  supplierOrderStatuses.find((item) => item.key === status)?.label ?? status;

export const getSupplierPaymentStatusLabel = (
  status: SupplierPaymentStatus,
) => supplierPaymentStatuses.find((item) => item.key === status)?.label ?? status;

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
) => {
  switch (columnKey) {
    case 'number':
      return 'No.';
    case 'product':
      return 'Product';
    case 'quantity':
      return 'Qty';
    case 'price':
      return 'Price';
    case 'total':
      return 'Total';
    case 'paid':
      return 'Paid';
    case 'supplier':
      return 'Supplier';
    case 'deliveryDate':
      return 'Delivery date';
    case 'status':
      return 'Status';
    case 'paymentStatus':
      return 'Payment status';
    default:
      return columnKey;
  }
};

export type SupplierOrdersFilters = {
  query: string;
  selectedStatuses: SupplierOrderStatus[];
  paymentStatus: SupplierPaymentStatus | 'all';
  deliveryDateFrom: string;
  deliveryDateTo: string;
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
    };
  } catch {
    return {
      query: '',
      selectedStatuses: [],
      paymentStatus: 'all',
      deliveryDateFrom: '',
      deliveryDateTo: '',
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
