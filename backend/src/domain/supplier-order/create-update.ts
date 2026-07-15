import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import { toNonEmptyString, toOptionalDate } from '../../shared/lib/parsers';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import {
  normalizeItems,
  toOrderStatus,
  toPaymentStatus,
  type SupplierOrderPayload,
} from './normalizers';
import {
  autoMarkZeroTotalOrdersWithoutPayment,
  CLOSURE_ORDER_STATUSES,
  isSupplierOrderReceived,
  withSupplierName,
} from './internal';

export const createSupplierOrder = async (payload: SupplierOrderPayload) => {
  const supplierId = toNonEmptyString(payload.supplierId);
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const deliveryDate = toOptionalDate(payload.deliveryDate);
  if (!deliveryDate) throw new HttpError(400, 'Valid delivery date is required.');

  const order = new SupplierOrder({
    orderBaseId: toNonEmptyString(payload.orderBaseId) || `SO-${Date.now()}`,
    supplier: supplierId,
    deliveryDate,
    supplyType: toNonEmptyString(payload.supplyType) || 'Локально',
    number: toNonEmptyString(payload.number),
    note: toNonEmptyString(payload.note),
    createdBy: toNonEmptyString(payload.createdBy),
    status: toOrderStatus(payload.status),
    paymentStatus: toPaymentStatus(payload.paymentStatus),
    items: normalizeItems(payload.items),
  });
  if (order.items.length === 0) throw new HttpError(400, 'At least one product item is required.');
  await order.validate();
  await order.save();
  await autoMarkZeroTotalOrdersWithoutPayment();
  return withSupplierName(order.toObject<SupplierOrderDocument>());
};

export const updateSupplierOrder = async (supplierOrderId: string, payload: SupplierOrderPayload) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');

  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');

  if (payload.status !== undefined) {
    const nextStatus = toOrderStatus(payload.status);
    if (CLOSURE_ORDER_STATUSES.has(nextStatus)) {
      if (isSupplierOrderReceived(existing)) {
        throw new HttpError(400, 'Оприбутковане замовлення не можна скасувати.');
      }
      existing.status = nextStatus;
      if (nextStatus === 'cancelled' && existing.paymentStatus === 'pending') {
        existing.paymentStatus = 'cancelled';
      }
      await existing.validate();
      await existing.save();
      return withSupplierName(existing.toObject<SupplierOrderDocument>());
    }
  }

  if (existing.paymentStatus === 'paid' || existing.paymentStatus === 'without_payment') {
    throw new HttpError(400, 'Оплачений заказ не можна редагувати.');
  }

  const nextSupplierId = toNonEmptyString(payload.supplierId) || existing.supplier.toString();
  isValidObjectIdOrThrow(nextSupplierId, 'supplierId');
  const nextDeliveryDate = toOptionalDate(payload.deliveryDate) ?? existing.deliveryDate;
  const nextItems =
    payload.items === undefined
      ? existing.items
      : normalizeItems(payload.items, existing.items);
  if (!nextItems.length) throw new HttpError(400, 'At least one product item is required.');

  existing.supplier = nextSupplierId as unknown as SupplierOrderDocument['supplier'];
  existing.deliveryDate = nextDeliveryDate;
  existing.supplyType = toNonEmptyString(payload.supplyType) || existing.supplyType;
  existing.number = payload.number === undefined ? existing.number : toNonEmptyString(payload.number);
  existing.note = payload.note === undefined ? existing.note : toNonEmptyString(payload.note);
  existing.set('items', nextItems);
  if (payload.paymentStatus !== undefined) {
    existing.paymentStatus = toPaymentStatus(payload.paymentStatus);
  }
  if (payload.status !== undefined) {
    const nextStatus = toOrderStatus(payload.status);
    existing.status = nextStatus;
    if (nextStatus === 'approved') {
      if (
        existing.paymentStatus !== 'paid' &&
        existing.paymentStatus !== 'without_payment'
      ) {
        existing.paymentStatus = 'pending';
      }
      if (existing.receiptStatus === 'received') {
        existing.receiptStatus = 'approved';
      }
    }
  }
  await existing.validate();
  await existing.save();
  await autoMarkZeroTotalOrdersWithoutPayment();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};
