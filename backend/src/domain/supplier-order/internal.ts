import { Supplier } from '../supplier/model';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import { formatSupplierOrder } from './formatters';
import {
  areAllSupplierOrderItemsReceived,
  resolveSupplierOrderStatusFromItems,
} from './status-resolver';

export const supplierBusinessTimeZone = 'Europe/Kiev';
export const CLOSURE_ORDER_STATUSES = new Set(['cancelled', 'unavailable']);

export const getSupplierBusinessDateKey = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: supplierBusinessTimeZone,
    year: 'numeric',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

export const isSupplierOrderReceived = (order: {
  status?: string;
  receiptStatus?: string;
  items?: Array<{ receiptStatus?: string }>;
}) =>
  areAllSupplierOrderItemsReceived(order.items ?? []) ||
  order.status === 'stocked' ||
  order.receiptStatus === 'received';

export const applyResolvedStatusFromItems = (
  order: SupplierOrderDocument,
  options?: { preserveManualStatus?: boolean },
) => {
  const resolved = resolveSupplierOrderStatusFromItems(order.items ?? []);
  if (resolved.status) {
    order.status = resolved.status;
    order.receiptStatus = resolved.receiptStatus;
    if (resolved.status === 'cancelled' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'cancelled';
    }
    return;
  }

  if (!options?.preserveManualStatus) {
    order.receiptStatus = resolved.receiptStatus;
  }
};

export const loadSupplierNameMap = async (orders: SupplierOrderDocument[]) => {
  const supplierIds = Array.from(
    new Set(
      orders
        .map((order) => order.supplier?.toString?.() ?? String(order.supplier ?? ''))
        .filter(Boolean),
    ),
  );
  if (supplierIds.length === 0) {
    return new Map<string, string>();
  }

  const suppliers = await Supplier.find({ _id: { $in: supplierIds } })
    .select({ name: 1 })
    .lean<Array<{ _id: { toString: () => string }; name?: string }>>();

  return new Map(
    suppliers.map((supplier) => [supplier._id.toString(), supplier.name ?? 'Не обрано']),
  );
};

export const formatOrdersWithSupplierNames = async (orders: SupplierOrderDocument[]) => {
  const names = await loadSupplierNameMap(orders);
  return orders.map((order) =>
    formatSupplierOrder({
      ...order,
      supplierName:
        names.get(order.supplier?.toString?.() ?? String(order.supplier ?? '')) ??
        'Не обрано',
    }),
  );
};

export const withSupplierName = async (order: SupplierOrderDocument) => {
  const [formatted] = await formatOrdersWithSupplierNames([order]);
  return formatted!;
};

export const autoMarkZeroTotalOrdersWithoutPayment = async () => {
  await SupplierOrder.updateMany(
    {
      paymentStatus: 'pending',
      total: { $eq: 0 },
      $or: [
        { status: { $in: ['approved', 'stocked'] } },
        { receiptStatus: { $in: ['approved', 'received'] } },
      ],
    },
    { $set: { paymentStatus: 'without_payment' } },
  );
};
