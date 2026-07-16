import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import { resolveSupplierOrderStatusFromItems } from './status-resolver';
import {
  autoMarkZeroTotalOrdersWithoutPayment,
  getSupplierBusinessDateKey,
} from './internal';

export const reconcileSupplierOrderStatuses = async () => {
  const candidates = await SupplierOrder.find({
    status: { $nin: ['stocked', 'cancelled', 'unavailable'] },
    items: { $elemMatch: { receiptStatus: 'received' } },
  });

  for (const order of candidates) {
    const resolved = resolveSupplierOrderStatusFromItems(order.items ?? []);
    if (!resolved.status) continue;

    const needsStatusUpdate = order.status !== resolved.status;
    const needsReceiptStatusUpdate = order.receiptStatus !== resolved.receiptStatus;
    if (!needsStatusUpdate && !needsReceiptStatusUpdate) continue;

    order.status = resolved.status;
    order.receiptStatus = resolved.receiptStatus;
    await order.validate();
    await order.save();
  }
};

export const autoMarkOverdueSupplierOrders = async (
  now: Date = new Date(),
) => {
  const todayKey = getSupplierBusinessDateKey(now);
  if (!todayKey) return;

  const candidates = await SupplierOrder.find({
    status: 'request',
    receiptStatus: { $ne: 'received' },
    items: { $not: { $elemMatch: { receiptStatus: 'received' } } },
  }).lean<SupplierOrderDocument[]>();

  const overdueIds = candidates
    .filter((order) => {
      const deliveryKey = getSupplierBusinessDateKey(order.deliveryDate);
      return Boolean(deliveryKey) && deliveryKey < todayKey;
    })
    .map((order) => order._id);

  if (overdueIds.length === 0) return;

  await SupplierOrder.updateMany(
    { _id: { $in: overdueIds } },
    { $set: { status: 'overdue' } },
  );
};

/** Derived status jobs — not on list GET (read path stays read-only). */
export const refreshSupplierOrderDerivedStatuses = async (now: Date = new Date()) => {
  await autoMarkZeroTotalOrdersWithoutPayment();
  await reconcileSupplierOrderStatuses();
  await autoMarkOverdueSupplierOrders(now);
};
