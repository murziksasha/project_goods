import { randomUUID } from 'node:crypto';
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

export const appendSupplierOrderTransition = (
  order: {
    status: string;
    receiptStatus: string;
    stockedAt?: Date | null;
    cancelledAt?: Date | null;
    statusTransitions?: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      fromReceiptStatus: string | null;
      toReceiptStatus: string;
      changedById?: string | null;
      changedByName?: string | null;
      changedAt: Date;
    }>;
  },
  prevStatus: string | null,
  prevReceiptStatus: string | null,
  now: Date = new Date(),
  actor?: { id?: string | null; name?: string | null } | null,
) => {
  if (
    prevStatus === order.status &&
    prevReceiptStatus === order.receiptStatus
  ) {
    return;
  }

  const nextTransitions = [
    ...(Array.isArray(order.statusTransitions) ? order.statusTransitions : []),
    {
      id: randomUUID(),
      fromStatus: prevStatus,
      toStatus: order.status,
      fromReceiptStatus: prevReceiptStatus,
      toReceiptStatus: order.receiptStatus,
      changedById: actor?.id ?? null,
      changedByName: actor?.name ?? null,
      changedAt: now,
    },
  ];
  order.statusTransitions = nextTransitions;

  if (
    (order.status === 'stocked' || order.receiptStatus === 'received') &&
    !order.stockedAt
  ) {
    order.stockedAt = now;
  }
  if (order.status === 'cancelled' && !order.cancelledAt) {
    order.cancelledAt = now;
  }
};

export const applyResolvedStatusFromItems = (
  order: SupplierOrderDocument,
  options?: { preserveManualStatus?: boolean },
) => {
  const prevStatus = order.status ?? null;
  const prevReceiptStatus = order.receiptStatus ?? null;
  const resolved = resolveSupplierOrderStatusFromItems(order.items ?? []);
  if (resolved.status) {
    order.status = resolved.status;
    order.receiptStatus = resolved.receiptStatus;
    if (resolved.status === 'cancelled' && order.paymentStatus === 'pending') {
      order.paymentStatus = 'cancelled';
    }
    appendSupplierOrderTransition(
      order as unknown as Parameters<typeof appendSupplierOrderTransition>[0],
      prevStatus,
      prevReceiptStatus,
    );
    return;
  }

  if (!options?.preserveManualStatus) {
    order.receiptStatus = resolved.receiptStatus;
    appendSupplierOrderTransition(
      order as unknown as Parameters<typeof appendSupplierOrderTransition>[0],
      prevStatus,
      prevReceiptStatus,
    );
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
