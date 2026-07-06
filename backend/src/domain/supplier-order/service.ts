import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { toNonEmptyString, toNumber, toOptionalDate } from '../../shared/lib/parsers';
import { Supplier } from '../supplier/model';
import { createFinanceTransaction } from '../finance/service';
import { Product } from '../product/model';
import { CatalogProduct } from '../catalog-product/model';
import { WarehouseSettings } from '../warehouse-settings/model';
import {
  formatProductArticle,
  formatProductSerialNumber,
  getNextProductArticleValue,
  getNextProductSerialNumberValue,
} from '../sequence/service';
import {
  SupplierOrder,
  type SupplierOrderDocument,
} from './model';
import { formatSupplierOrder, getSupplierOrderDisplayNumber } from './formatters';
import {
  normalizeItems,
  toOrderStatus,
  toPaymentStatus,
  type StockedProductSummary,
  type SupplierOrderPayload,
  type SupplierOrderTakeOnChargePayload,
} from './normalizers';
import {
  areAllSupplierOrderItemsReceived,
  resolveSupplierOrderStatusFromItems,
} from './status-resolver';

export type { SupplierOrderPayload } from './normalizers';

const supplierBusinessTimeZone = 'Europe/Kiev';
const CLOSURE_ORDER_STATUSES = new Set(['cancelled', 'unavailable']);

const getSupplierBusinessDateKey = (value: string | Date) => {
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

const isSupplierOrderReceived = (order: {
  status?: string;
  receiptStatus?: string;
  items?: Array<{ receiptStatus?: string }>;
}) =>
  areAllSupplierOrderItemsReceived(order.items ?? []) ||
  order.status === 'stocked' ||
  order.receiptStatus === 'received';

const applyResolvedStatusFromItems = (
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

const withSupplierName = async (order: SupplierOrderDocument) => {
  const supplier = await Supplier.findById(order.supplier).lean();
  return formatSupplierOrder({
    ...order,
    supplierName: supplier?.name ?? 'Не обрано',
  });
};

const autoMarkZeroTotalOrdersWithoutPayment = async () => {
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

export const listSupplierOrders = async (queryValue: unknown) => {
  await autoMarkZeroTotalOrdersWithoutPayment();
  await reconcileSupplierOrderStatuses();
  await autoMarkOverdueSupplierOrders();
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

  if (payload.status !== undefined) {
    const nextStatus = toOrderStatus(payload.status);
    if (CLOSURE_ORDER_STATUSES.has(nextStatus)) {
      if (isSupplierOrderReceived(existing)) {
        throw new Error('Оприбутковане замовлення не можна скасувати.');
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
    throw new Error('Оплачений заказ не можна редагувати.');
  }

  const nextSupplierId = toNonEmptyString(payload.supplierId) || existing.supplier.toString();
  isValidObjectIdOrThrow(nextSupplierId, 'supplierId');
  const nextDeliveryDate = toOptionalDate(payload.deliveryDate) ?? existing.deliveryDate;
  const nextItems =
    payload.items === undefined
      ? existing.items
      : normalizeItems(payload.items, existing.items);
  if (!nextItems.length) throw new Error('At least one product item is required.');

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
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const updateSupplierOrderFavorite = async (
  supplierOrderId: string,
  payload: { isFavorite?: unknown },
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');

  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');

  existing.isFavorite = payload.isFavorite === true;
  await existing.save();
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const listSupplierOrdersForAccounting = async () => {
  await autoMarkZeroTotalOrdersWithoutPayment();
  const orders = await SupplierOrder.find({
    status: {
      $in: [
        'approved',
        'overdue',
        'partially_stocked',
        'partially_completed',
        'stocked',
      ],
    },
    paymentStatus: 'pending',
    total: { $gt: 0 },
  })
    .sort({ createdAt: -1 })
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
  if (existing.paymentStatus === 'without_payment') throw new Error('Замовлення вже видано без оплати.');
  if (
    existing.status !== 'approved' &&
    existing.status !== 'overdue' &&
    existing.status !== 'stocked' &&
    existing.status !== 'partially_stocked' &&
    existing.status !== 'partially_completed'
  ) {
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
    note:
      toNonEmptyString(payload.note) ||
      `Supplier order payment: ${getSupplierOrderDisplayNumber(existing)}`,
    transactionDate: payload.transactionDate,
  });

  existing.paymentStatus = 'paid';
  existing.receiptStatus = existing.receiptStatus === 'new' ? 'approved' : existing.receiptStatus;
  await existing.validate();
  existing.paid = existing.total;
  await existing.save();

  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const issueSupplierOrderWithoutPayment = async (
  supplierOrderId: string,
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.paymentStatus === 'paid') throw new Error('Замовлення вже сплачено.');
  if (existing.paymentStatus === 'without_payment') throw new Error('Замовлення вже видано без оплати.');
  if (
    existing.status !== 'approved' &&
    existing.status !== 'overdue' &&
    existing.status !== 'stocked' &&
    existing.status !== 'partially_stocked' &&
    existing.status !== 'partially_completed'
  ) {
    throw new Error('Видача без оплати доступна тільки для замовлень зі статусом approved або stocked.');
  }

  existing.paymentStatus = 'without_payment';
  existing.receiptStatus = existing.receiptStatus === 'new' ? 'approved' : existing.receiptStatus;
  await existing.validate();
  await existing.save();

  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

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

const reserveNextProductArticle = async () =>
  formatProductArticle(await getNextProductArticleValue());

export const cancelSupplierOrder = async (supplierOrderId: string) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.status === 'cancelled' || existing.paymentStatus === 'cancelled') {
    throw new Error('Замовлення вже скасовано.');
  }
  if (existing.paymentStatus === 'paid' || existing.paymentStatus === 'without_payment') {
    throw new Error('Оплачений заказ не можна скасувати.');
  }
  if (isSupplierOrderReceived(existing)) {
    throw new Error('Оприбутковане замовлення не можна скасувати.');
  }

  for (const item of existing.items ?? []) {
    if (item.receiptStatus !== 'received' && item.receiptStatus !== 'cancelled') {
      item.receiptStatus = 'cancelled';
    }
  }

  existing.status = 'cancelled';
  existing.paymentStatus = 'cancelled';
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
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.status === 'cancelled' || existing.status === 'unavailable') {
    throw new Error('Closed supplier order cannot cancel items.');
  }

  const itemIndex = Math.max(0, Math.floor(toNumber(payload?.itemIndex)));
  const targetItem = (existing.items ?? []).find(
    (item) => item.itemIndex === itemIndex,
  );
  if (!targetItem) {
    throw new Error('Selected supplier order item not found.');
  }
  if (targetItem.receiptStatus === 'received') {
    throw new Error('Received supplier order item cannot be cancelled.');
  }
  if (targetItem.receiptStatus === 'cancelled') {
    throw new Error('Supplier order item is already cancelled.');
  }

  targetItem.receiptStatus = 'cancelled';
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
  return withSupplierName(existing.toObject<SupplierOrderDocument>());
};

export const takeOnChargeSupplierOrder = async (
  supplierOrderId: string,
  payload?: SupplierOrderTakeOnChargePayload,
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new Error('Supplier order not found.');
  if (existing.status === 'cancelled' || existing.status === 'unavailable') {
    throw new Error('Closed supplier order cannot be taken on charge.');
  }

  const requestedItemIndexRaw = toNumber(payload?.itemIndex);
  const hasRequestedItemIndex = Number.isFinite(requestedItemIndexRaw);
  const requestedItemIndex = hasRequestedItemIndex
    ? Math.max(0, Math.floor(requestedItemIndexRaw))
    : undefined;
  const targetItems =
    requestedItemIndex === undefined
      ? existing.items ?? []
      : (existing.items ?? []).filter(
          (item) => item.itemIndex === requestedItemIndex,
        );
  if (targetItems.length === 0) {
    throw new Error('Selected supplier order item not found.');
  }

  const blockedItem = targetItems.find(
    (item) =>
      item.receiptStatus === 'received' || item.receiptStatus === 'cancelled',
  );
  if (blockedItem) {
    if (blockedItem.receiptStatus === 'received') {
      throw new Error('Supplier order item is already received.');
    }
    throw new Error('Cancelled supplier order item cannot be taken on charge.');
  }

  const autoGenerateSerialNumbers =
    payload?.autoGenerateSerialNumbers !== false;
  const autoGenerateArticles = payload?.autoGenerateArticles !== false;
  const totalUnits = targetItems.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.quantity)),
    0,
  );
  const manualSerialNumbers = Array.isArray(payload?.serialNumbers)
    ? payload.serialNumbers
        .map((value) => toNonEmptyString(value).toUpperCase())
        .filter(Boolean)
    : [];
  const manualArticleBase = toNonEmptyString(payload?.articleBase).toUpperCase();
  const useManualArticle = !autoGenerateArticles;

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
  const activeWarehouses = configuredWarehouses.filter(
    (warehouse) => warehouse.isActive !== false,
  );
  const defaultWarehouse = activeWarehouses[0];
  const requestedWarehouseId = toNonEmptyString(payload?.warehouseId);
  const requestedWarehouse = requestedWarehouseId
    ? configuredWarehouses.find(
        (warehouse) => warehouse.id === requestedWarehouseId,
      )
    : undefined;
  if (requestedWarehouseId && !requestedWarehouse) {
    throw new Error('Selected warehouse was not found.');
  }
  if (requestedWarehouse && requestedWarehouse.isActive === false) {
    throw new Error('Selected warehouse is inactive.');
  }
  const matchedWarehouse = requestedWarehouse ?? defaultWarehouse;
  if (!matchedWarehouse) {
    throw new Error('No active warehouse is available for take on charge.');
  }
  const requestedLocationId = toNonEmptyString(payload?.locationId);
  const requestedLocation = requestedLocationId
    ? (matchedWarehouse.locations ?? []).find(
        (location) => location.id === requestedLocationId,
      )
    : undefined;
  if (requestedLocationId && !requestedLocation) {
    throw new Error('Selected warehouse location was not found.');
  }
  const matchedLocation =
    requestedLocation ?? matchedWarehouse.locations?.[0];
  if (!matchedLocation) {
    throw new Error('Selected warehouse has no locations.');
  }
  let serialCursor = 0;
  const stockedProducts: StockedProductSummary[] = [];

  for (const item of targetItems) {
    const catalogName = item.catalogProductId
      ? (
          await CatalogProduct.findById(item.catalogProductId)
            .select({ name: 1 })
            .lean<{ name?: string } | null>()
        )?.name
      : undefined;
    const normalizedName = toNonEmptyString(catalogName || item.productName);
    if (!normalizedName) continue;
    const articleForItem = useManualArticle
      ? manualArticleBase
      : await reserveNextProductArticle();

    const quantity = Math.max(0, Math.floor(item.quantity));
    for (let unitIndex = 0; unitIndex < quantity; unitIndex += 1) {
      const serialNumber = autoGenerateSerialNumbers
        ? await reserveNextUniqueProductSerialNumber()
        : manualSerialNumbers[serialCursor] ?? '';
      serialCursor += 1;

      const newProduct = new Product({
        name: normalizedName,
        article: articleForItem,
        serialNumber,
        price: item.price,
        salePriceOptions: [],
        note: existing.note ?? '',
        quantity: 1,
        reservedQuantity: 0,
        purchasePlace: matchedWarehouse?.name ?? supplier?.name ?? '',
        warehouseId: matchedWarehouse?.id ?? '',
        locationId: matchedLocation?.id ?? '',
        supplierOrderId: supplierOrderId,
        supplierOrderItemIndex: item.itemIndex,
        purchaseDate: new Date(),
        warrantyPeriod: 0,
        isActive: true,
      });
      await newProduct.validate();
      await newProduct.save();
      stockedProducts.push({
        id: String(newProduct._id),
        name: newProduct.name ?? '',
        article: newProduct.article ?? '',
        serialNumber: newProduct.serialNumber ?? '',
      });
    }
    item.receiptStatus = 'received';
  }

  applyResolvedStatusFromItems(existing);
  if (existing.total <= 0) {
    existing.paymentStatus = 'without_payment';
  } else if (existing.paymentStatus !== 'paid' && existing.paymentStatus !== 'without_payment') {
    existing.paymentStatus = 'pending';
  }
  await existing.validate();
  await existing.save();
  return {
    ...(await withSupplierName(existing.toObject<SupplierOrderDocument>())),
    stockedProducts,
  };
};


