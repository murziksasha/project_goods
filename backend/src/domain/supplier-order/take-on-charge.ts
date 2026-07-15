import { isValidObjectIdOrThrow } from '../../shared/lib/query';
import { HttpError } from '../../shared/lib/errors';
import { toNonEmptyString, toNumber } from '../../shared/lib/parsers';
import { Supplier } from '../supplier/model';
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
import {
  type StockedProductSummary,
  type SupplierOrderTakeOnChargePayload,
} from './normalizers';
import {
  applyResolvedStatusFromItems,
  autoMarkZeroTotalOrdersWithoutPayment,
  withSupplierName,
} from './internal';

const reserveNextUniqueProductSerialNumber = async () => {
  for (let attempts = 0; attempts < 2000; attempts += 1) {
    const candidate = formatProductSerialNumber(
      await getNextProductSerialNumberValue(),
    );
    const exists = await Product.exists({ serialNumber: candidate });
    if (!exists) return candidate;
  }

  throw new HttpError(500, 'Failed to generate unique product serial number.');
};

const reserveNextProductArticle = async () =>
  formatProductArticle(await getNextProductArticleValue());

export const takeOnChargeSupplierOrder = async (
  supplierOrderId: string,
  payload?: SupplierOrderTakeOnChargePayload,
) => {
  isValidObjectIdOrThrow(supplierOrderId, 'supplierOrderId');
  const existing = await SupplierOrder.findById(supplierOrderId);
  if (!existing) throw new HttpError(404, 'Supplier order not found.');
  if (existing.status === 'cancelled' || existing.status === 'unavailable') {
    throw new HttpError(400, 'Closed supplier order cannot be taken on charge.');
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
    throw new HttpError(404, 'Selected supplier order item not found.');
  }

  const blockedItem = targetItems.find(
    (item) =>
      item.receiptStatus === 'received' || item.receiptStatus === 'cancelled',
  );
  if (blockedItem) {
    if (blockedItem.receiptStatus === 'received') {
      throw new HttpError(409, 'Supplier order item is already received.');
    }
    throw new HttpError(400, 'Cancelled supplier order item cannot be taken on charge.');
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
    throw new HttpError(400, 'Serial numbers count must match total units.');
  }

  if (!autoGenerateSerialNumbers) {
    const hasDuplicateManualSerial = manualSerialNumbers.some(
      (serial, index) => manualSerialNumbers.indexOf(serial) !== index,
    );
    if (hasDuplicateManualSerial) {
      throw new HttpError(400, 'Serial numbers must be unique.');
    }
    const existingSerialProduct = await Product.findOne({
      serialNumber: { $in: manualSerialNumbers },
    })
      .select({ serialNumber: 1 })
      .lean<{ serialNumber?: string } | null>();
    if (existingSerialProduct?.serialNumber) {
      throw new HttpError(
        409,
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
    throw new HttpError(404, 'Selected warehouse was not found.');
  }
  if (requestedWarehouse && requestedWarehouse.isActive === false) {
    throw new HttpError(400, 'Selected warehouse is inactive.');
  }
  const matchedWarehouse = requestedWarehouse ?? defaultWarehouse;
  if (!matchedWarehouse) {
    throw new HttpError(400, 'No active warehouse is available for take on charge.');
  }
  const requestedLocationId = toNonEmptyString(payload?.locationId);
  const requestedLocation = requestedLocationId
    ? (matchedWarehouse.locations ?? []).find(
        (location) => location.id === requestedLocationId,
      )
    : undefined;
  if (requestedLocationId && !requestedLocation) {
    throw new HttpError(404, 'Selected warehouse location was not found.');
  }
  const matchedLocation =
    requestedLocation ?? matchedWarehouse.locations?.[0];
  if (!matchedLocation) {
    throw new HttpError(400, 'Selected warehouse has no locations.');
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
  await autoMarkZeroTotalOrdersWithoutPayment();
  return {
    ...(await withSupplierName(existing.toObject<SupplierOrderDocument>())),
    stockedProducts,
  };
};
