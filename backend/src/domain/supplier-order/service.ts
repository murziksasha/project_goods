import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { toNonEmptyString, toNumber, toOptionalDate } from '../../shared/lib/parsers';
import mongoose from 'mongoose';
import { Supplier } from '../supplier/model';
import { createFinanceTransaction } from '../finance/service';
import { Product } from '../product/model';
import { CatalogProduct } from '../catalog-product/model';
import { WarehouseSettings } from '../warehouse-settings/model';
import {
  formatProductSerialNumber,
  getNextProductSerialNumberValue,
} from '../sequence/service';
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

type SupplierOrderTakeOnChargePayload = {
  autoGenerateSerialNumbers?: unknown;
  serialNumbers?: unknown;
  warehouseId?: unknown;
  locationId?: unknown;
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
    status: { $in: ['approved', 'stocked'] },
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
  if (existing.status !== 'approved' && existing.status !== 'stocked') {
    throw new Error('Оплата доступна тільки для замовлень зі статусом approved або stocked.');
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

const toReceiptArticle = (orderBaseId: string, itemIndex: number) =>
  `SO-${orderBaseId.replace(/[^A-Za-z0-9]/g, '').slice(-8)}-${itemIndex + 1}`;

const reserveNextUniqueProductSerialNumber = async () => {
  for (let attempts = 0; attempts < 2000; attempts += 1) {
    const candidate = formatProductSerialNumber(
      await getNextProductSerialNumberValue(),
    );
    const exists = await Product.exists({ serialNumber: candidate });
    if (!exists) return candidate;
  }

  throw new Error('Failed to generate unique product serial number.');
};

export const cancelSupplierOrder = async (supplierOrderId: string) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.paymentStatus === 'paid') throw new Error('Оплачений заказ не можна скасувати.');

  existing.status = 'cancelled';
  existing.paymentStatus = 'cancelled';
  await existing.validate();
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const takeOnChargeSupplierOrder = async (
  supplierOrderId: string,
  payload?: SupplierOrderTakeOnChargePayload,
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.status === 'cancelled') {
    throw new Error('Cancelled supplier order cannot be taken on charge.');
  }

  const autoGenerateSerialNumbers =
    payload?.autoGenerateSerialNumbers !== false;
  const totalUnits = (existing.items ?? []).reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.quantity)),
    0,
  );
  const manualSerialNumbers = Array.isArray(payload?.serialNumbers)
    ? payload.serialNumbers
        .map((value) => toNonEmptyString(value).toUpperCase())
        .filter(Boolean)
    : [];

  if (
    !autoGenerateSerialNumbers &&
    manualSerialNumbers.length !== totalUnits
  ) {
    throw new Error('Serial numbers count must match total units.');
  }

  if (!autoGenerateSerialNumbers) {
    const hasDuplicateManualSerial = manualSerialNumbers.some(
      (serial, index) => manualSerialNumbers.indexOf(serial) !== index,
    );
    if (hasDuplicateManualSerial) {
      throw new Error('Serial numbers must be unique.');
    }
    const existingSerialProduct = await Product.findOne({
      serialNumber: { $in: manualSerialNumbers },
    })
      .select({ serialNumber: 1 })
      .lean<{ serialNumber?: string } | null>();
    if (existingSerialProduct?.serialNumber) {
      throw new Error(
        `Product serial number already exists: ${existingSerialProduct.serialNumber}`,
      );
    }
  }

  const supplier = await Supplier.findById(existing.supplier).lean();
  const warehouseSettings = await WarehouseSettings.findOne().lean();
  const configuredWarehouses = warehouseSettings?.warehouses ?? [];
  const defaultWarehouse = configuredWarehouses[0];
  const requestedWarehouseId = toNonEmptyString(payload?.warehouseId);
  const matchedWarehouse =
    configuredWarehouses.find((warehouse) => warehouse.id === requestedWarehouseId) ??
    defaultWarehouse;
  const requestedLocationId = toNonEmptyString(payload?.locationId);
  const matchedLocation =
    (matchedWarehouse?.locations ?? []).find((location) => location.id === requestedLocationId) ??
    matchedWarehouse?.locations?.[0];
  let serialCursor = 0;

  for (const item of existing.items ?? []) {
    const catalogName = item.catalogProductId
      ? (
          await CatalogProduct.findById(item.catalogProductId)
            .select({ name: 1 })
            .lean<{ name?: string } | null>()
        )?.name
      : undefined;
    const normalizedName = toNonEmptyString(catalogName || item.productName);
    if (!normalizedName) continue;

    const quantity = Math.max(0, Math.floor(item.quantity));
    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const serialNumber = autoGenerateSerialNumbers
        ? await reserveNextUniqueProductSerialNumber()
        : manualSerialNumbers[serialCursor] ?? '';
      serialCursor += 1;

      const newProduct = new Product({
        name: normalizedName,
        article: `${toReceiptArticle(existing.orderBaseId, item.itemIndex)}-${unitIndex + 1}`,
        serialNumber,
        price: item.price,
        salePriceOptions: [],
        note: existing.note ?? '',
        quantity: 1,
        reservedQuantity: 0,
        purchasePlace: matchedWarehouse?.name ?? supplier?.name ?? '',
        warehouseId: matchedWarehouse?.id ?? '',
        locationId: matchedLocation?.id ?? '',
        purchaseDate: new Date(),
        warrantyPeriod: 0,
        isActive: true,
      });
      await newProduct.validate();
      await newProduct.save();
    }
  }

  existing.status = 'stocked';
  existing.receiptStatus = 'received';
  if (existing.paymentStatus !== 'paid') existing.paymentStatus = 'pending';
  await existing.validate();
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};
