import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import { toNonEmptyString, toNumber } from '../../shared/lib/parsers';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import {
  applyResolvedStatusFromItems,
  autoMarkZeroTotalOrdersWithoutPayment,
  appendSupplierOrderTransition,
  isSupplierOrderReceived,
  withSupplierName,
} from './internal';

export const cancelSupplierOrder = async (supplierOrderId: string) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');
  if (existing.status === 'cancelled' || existing.paymentStatus === 'cancelled') {
    throw new HttpError(409, 'Замовлення вже скасовано.');
  }
  if (existing.paymentStatus === 'paid' || existing.paymentStatus === 'without_payment') {
    throw new HttpError(400, 'Оплачений заказ не можна скасувати.');
  }
  if (isSupplierOrderReceived(existing)) {
    throw new HttpError(400, 'Оприбутковане замовлення не можна скасувати.');
  }

  const now = new Date();
  const prevStatus = existing.status ?? null;
  const prevReceiptStatus = existing.receiptStatus ?? null;

  for (const item of existing.items ?? []) {
    if (item.receiptStatus !== 'received' && item.receiptStatus !== 'cancelled') {
      item.receiptStatus = 'cancelled';
      (item as { cancelledAt?: Date | null }).cancelledAt =
        (item as { cancelledAt?: Date | null }).cancelledAt ?? now;
    }
  }

  existing.status = 'cancelled';
  existing.paymentStatus = 'cancelled';
  appendSupplierOrderTransition(
    existing as unknown as Parameters<typeof appendSupplierOrderTransition>[0],
    prevStatus,
    prevReceiptStatus,
    now,
  );
  await existing.validate();
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const cancelSupplierOrderItem = async (
  supplierOrderId: string,
  payload?: { itemIndex?: unknown; reason?: unknown },
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');
  if (existing.status === 'cancelled' || existing.status === 'unavailable') {
    throw new HttpError(400, 'Closed supplier order cannot cancel items.');
  }

  const itemIndex = Math.max(0, Math.floor(toNumber(payload?.itemIndex)));
  const targetItem = (existing.items ?? []).find(
    (item) => item.itemIndex === itemIndex,
  );
  if (!targetItem) {
    throw new HttpError(404, 'Selected supplier order item not found.');
  }
  if (targetItem.receiptStatus === 'received') {
    throw new HttpError(400, 'Received supplier order item cannot be cancelled.');
  }
  if (targetItem.receiptStatus === 'cancelled') {
    throw new HttpError(409, 'Supplier order item is already cancelled.');
  }

  const now = new Date();
  targetItem.receiptStatus = 'cancelled';
  (targetItem as { cancelledAt?: Date | null }).cancelledAt = now;
  const reason = toNonEmptyString(payload?.reason);
  if (reason) {
    const marker = `[ITEM_CANCELLED:${itemIndex}] ${reason}`;
    existing.note = existing.note?.trim()
      ? `${existing.note.trim()}\n${marker}`
      : marker;
  }

  applyResolvedStatusFromItems(existing);
  await existing.validate();
  await existing.save();
  await autoMarkZeroTotalOrdersWithoutPayment();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};
