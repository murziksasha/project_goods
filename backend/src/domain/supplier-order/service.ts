import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { toNonEmptyString, toNumber, toOptionalDate } from '../../shared/lib/parsers';
import mongoose from 'mongoose';
import { Supplier } from '../supplier/model';
import { createFinanceTransaction } from '../finance/service';
import { SupplierOrder, supplierOrderStatuses, supplierPaymentStatuses, type SupplierOrderDocument } from './model';

type SupplierOrderItemPayload = {
  lineId?: unknown;
  itemIndex?: unknown;
  catalogProductId?: unknown;
  productName?: unknown;
  quantity?: unknown;
  price?: unknown;
};

export type SupplierOrderPayload = {
  orderBaseId?: unknown;
  supplierId?: unknown;
  deliveryDate?: unknown;
  supplyType?: unknown;
  number?: unknown;
  note?: unknown;
  createdBy?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  items?: unknown;
};

const toOrderStatus = (value: unknown) =>
  supplierOrderStatuses.includes(String(value ?? '') as (typeof supplierOrderStatuses)[number])
    ? (value as (typeof supplierOrderStatuses)[number])
    : 'request';

const toPaymentStatus = (value: unknown) =>
  supplierPaymentStatuses.includes(String(value ?? '') as (typeof supplierPaymentStatuses)[number])
    ? (value as (typeof supplierPaymentStatuses)[number])
    : 'pending';

type NormalizedSupplierOrderItem = {
  lineId: string;
  itemIndex: number;
  catalogProductId?: string;
  productName: string;
  quantity: number;
  price: number;
};

const normalizeItems = (items: unknown): NormalizedSupplierOrderItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const raw = item as SupplierOrderItemPayload;
      const productName = toNonEmptyString(raw.productName);
      const quantity = toNumber(raw.quantity);
      const price = toNumber(raw.price);
      const catalogProductIdRaw = toNonEmptyString(raw.catalogProductId);
      const catalogProductId = mongoose.isValidObjectId(catalogProductIdRaw)
        ? catalogProductIdRaw
        : undefined;
      const lineId = toNonEmptyString(raw.lineId) || `line-${index + 1}`;
      const itemIndex = Number.isFinite(toNumber(raw.itemIndex)) ? Math.max(0, Math.floor(toNumber(raw.itemIndex))) : index;

      return {
        lineId,
        itemIndex,
        catalogProductId,
        productName,
        quantity,
        price,
      };
    })
    .filter((item) => item.productName.length >= 2 && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0)
    .sort((a, b) => a.itemIndex - b.itemIndex);
};

const formatSupplierOrder = (order: SupplierOrderDocument & { supplierName?: string }) => ({
  id: order._id.toString(),
  orderBaseId: order.orderBaseId,
  supplierId: order.supplier.toString(),
  supplierName: order.supplierName ?? '',
  deliveryDate: order.deliveryDate.toISOString(),
  supplyType: order.supplyType ?? 'Локально',
  number: order.number ?? '',
  note: order.note ?? '',
  createdBy: order.createdBy ?? '',
  status: order.status,
  paymentStatus: order.paymentStatus,
  receiptStatus: order.receiptStatus,
  total: order.total,
  paid: order.paid,
  items: (order.items ?? []).map((item) => ({
    lineId: item.lineId,
    itemIndex: item.itemIndex,
    catalogProductId: item.catalogProductId
      ? item.catalogProductId.toString()
      : undefined,
    productName: item.productName,
    quantity: item.quantity,
    price: item.price,
  })),
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
});

const withSupplierName = async (order: SupplierOrderDocument) => {
  const supplier = await Supplier.findById(order.supplier).lean();
  return formatSupplierOrder({
    ...order,
    supplierName: supplier?.name ?? 'Не обрано',
  });
};

export const listSupplierOrders = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const orders = await SupplierOrder.find(query).sort({ createdAt: -1 }).lean<SupplierOrderDocument[]>();
  return Promise.all(orders.map((order) => withSupplierName(order)));
};

export const createSupplierOrder = async (payload: SupplierOrderPayload) => {
  const supplierId = toNonEmptyString(payload.supplierId);
  isValidObjectIdOrThrow(supplierId, 'supplierId');
  const deliveryDate = toOptionalDate(payload.deliveryDate);
  if (!deliveryDate) throw new Error('Valid delivery date is required.');

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
  if (order.items.length === 0) throw new Error('At least one product item is required.');
  await order.validate();
  await order.save();
  return withSupplierName(order.toObject<SupplierOrderDocument>());
};

export const updateSupplierOrder = async (supplierOrderId: string, payload: SupplierOrderPayload) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');

  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');

  if (existing.paymentStatus === 'paid') {
    throw new Error('Оплачений заказ не можна редагувати.');
  }

  const nextSupplierId = toNonEmptyString(payload.supplierId) || existing.supplier.toString();
  isValidObjectIdOrThrow(nextSupplierId, 'supplierId');
  const nextDeliveryDate = toOptionalDate(payload.deliveryDate) ?? existing.deliveryDate;
  const nextItems = payload.items === undefined ? existing.items : normalizeItems(payload.items);
  if (!nextItems.length) throw new Error('At least one product item is required.');

  existing.supplier = nextSupplierId as unknown as SupplierOrderDocument['supplier'];
  existing.deliveryDate = nextDeliveryDate;
  existing.supplyType = toNonEmptyString(payload.supplyType) || existing.supplyType;
  existing.number = payload.number === undefined ? existing.number : toNonEmptyString(payload.number);
  existing.note = payload.note === undefined ? existing.note : toNonEmptyString(payload.note);
  existing.set('items', nextItems);
  if (payload.status !== undefined) {
    const nextStatus = toOrderStatus(payload.status);
    existing.status = nextStatus;
    if (nextStatus === 'approved') {
      existing.paymentStatus = 'pending';
      if (existing.receiptStatus === 'received') {
        existing.receiptStatus = 'approved';
      }
    }
  }
  if (payload.paymentStatus !== undefined) existing.paymentStatus = toPaymentStatus(payload.paymentStatus);
  await existing.validate();
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const listSupplierOrdersForAccounting = async () => {
  const orders = await SupplierOrder.find({
    status: 'approved',
    paymentStatus: 'pending',
  })
    .sort({ deliveryDate: 1, createdAt: 1 })
    .lean<SupplierOrderDocument[]>();

  return Promise.all(
    orders.map(async (order) => {
      const withName = await withSupplierName(order);
      return {
        id: withName.id,
        orderBaseId: withName.orderBaseId,
        number: withName.number,
        supplierName: withName.supplierName,
        deliveryDate: withName.deliveryDate,
        total: withName.total,
        createdAt: withName.createdAt,
      };
    }),
  );
};

export const paySupplierOrder = async (
  supplierOrderId: string,
  payload: { cashboxId?: unknown; note?: unknown; transactionDate?: unknown },
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.paymentStatus === 'paid') throw new Error('Замовлення вже сплачено.');
  if (existing.status !== 'approved') {
    throw new Error('Оплата доступна тільки для замовлень зі статусом approved.');
  }

  const cashboxId = toNonEmptyString(payload.cashboxId);
  isValidObjectIdOrThrow(cashboxId, 'cashboxId');

  await createFinanceTransaction({
    type: 'withdraw',
    amount: existing.total,
    currency: 'UAH',
    fromCashboxId: cashboxId,
    toCashboxId: '',
    note: toNonEmptyString(payload.note) || `Supplier order payment: ${existing.orderBaseId}`,
    transactionDate: payload.transactionDate,
  });

  existing.paymentStatus = 'paid';
  existing.receiptStatus = existing.receiptStatus === 'new' ? 'approved' : existing.receiptStatus;
  await existing.validate();
  await existing.save();

  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};
