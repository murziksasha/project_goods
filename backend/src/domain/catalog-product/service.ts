import mongoose from 'mongoose';
import { formatCatalogProduct } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { CatalogProduct, type CatalogProductDocument } from './model';
import {
  assertCatalogProductNameFitsWarehouse,
  buildCatalogLineItemNamePattern,
  buildCatalogSnapshotNamePattern,
  catalogProductNamesAreEqual,
  normalizeCatalogProductName,
  renameSaleForCatalogProduct,
  renameSupplierOrderItems,
  shouldPropagateCatalogProductRename,
} from './name-propagation';
import { Product } from '../product/model';
import { getExactProductModelNameQuery } from '../product/service';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';

export type CatalogProductPayload = {
  name?: unknown;
  note?: unknown;
  isActive?: unknown;
};

const normalizeCatalogProductPayload = (payload: CatalogProductPayload) => ({
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true || String(payload.isActive).toLowerCase() === 'true',
});

const mapCatalogProductError = (error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000) {
    return new Error('Catalog product with this name already exists.');
  }
  return error;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type PropagateCatalogProductNameChangeInput = {
  catalogProductId: string;
  previousName: string;
  nextName: string;
};

export const propagateCatalogProductNameChange = async ({
  catalogProductId,
  previousName,
  nextName,
}: PropagateCatalogProductNameChangeInput) => {
  const normalizedPreviousName = normalizeCatalogProductName(previousName);
  const normalizedNextName = normalizeCatalogProductName(nextName);

  if (!shouldPropagateCatalogProductRename(normalizedPreviousName, normalizedNextName)) {
    return;
  }

  assertCatalogProductNameFitsWarehouse(normalizedNextName);

  const catalogObjectId = new mongoose.Types.ObjectId(catalogProductId);
  const products = await Product.find(getExactProductModelNameQuery(normalizedPreviousName));
  const matchingProducts = products.filter((product) =>
    catalogProductNamesAreEqual(product.name, normalizedPreviousName),
  );

  for (const product of matchingProducts) {
    product.name = normalizedNextName;
    await product.validate();
    await product.save();
  }

  const supplierOrders = await SupplierOrder.find({
    $or: [
      { 'items.catalogProductId': catalogObjectId },
      {
        'items.productName': {
          $regex: buildCatalogSnapshotNamePattern(normalizedPreviousName),
          $options: 'i',
        },
      },
    ],
  });

  for (const order of supplierOrders) {
    const nextItems = renameSupplierOrderItems(
      order.items ?? [],
      catalogProductId,
      normalizedPreviousName,
      normalizedNextName,
    );

    if (JSON.stringify(nextItems) === JSON.stringify(order.items ?? [])) {
      continue;
    }

    order.set('items', nextItems);
    await order.validate();
    await order.save();
  }

  const linkedSales = await Sale.find({
    $or: [
      { 'lineItems.catalogProductId': catalogObjectId },
      {
        'productSnapshot.name': {
          $regex: buildCatalogSnapshotNamePattern(normalizedPreviousName),
          $options: 'i',
        },
      },
      {
        'lineItems.name': {
          $regex: buildCatalogLineItemNamePattern(normalizedPreviousName),
          $options: 'i',
        },
      },
    ],
  }).lean();

  await Promise.all(
    linkedSales.map(async (sale) => {
      const {
        snapshotChanged,
        lineItemsChanged,
        nextSnapshotName,
        nextLineItems,
      } = renameSaleForCatalogProduct(
        sale,
        catalogProductId,
        normalizedPreviousName,
        normalizedNextName,
      );

      if (!snapshotChanged && !lineItemsChanged) {
        return;
      }

      await Sale.findByIdAndUpdate(sale._id, {
        ...(snapshotChanged
          ? {
              productSnapshot: {
                article: sale.productSnapshot?.article ?? '',
                name: nextSnapshotName,
                serialNumber: sale.productSnapshot?.serialNumber ?? '',
              },
            }
          : {}),
        ...(lineItemsChanged ? { lineItems: nextLineItems } : {}),
      });
    }),
  );
};

const getCatalogProductUsageCount = async (item: CatalogProductDocument) => {
  const normalizedName = normalizeCatalogProductName(item.name);
  if (!normalizedName) return 0;

  const normalizedNamePattern = escapeRegExp(normalizedName).replace(/\s+/g, '\\s+');
  return Sale.countDocuments({
    $or: [
      { 'productSnapshot.name': { $regex: `^${normalizedNamePattern}$`, $options: 'i' } },
      { 'lineItems.name': { $regex: `^${normalizedNamePattern}(?:\\s*\\(.*\\))?$`, $options: 'i' } },
      { note: { $regex: escapeRegExp(normalizedName), $options: 'i' } },
    ],
  });
};

export const listCatalogProducts = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const items = await CatalogProduct.find(query)
    .sort({ createdAt: -1 })
    .lean<CatalogProductDocument[]>();
  return Promise.all(
    items.map(async (item) => {
      const usageCount = await getCatalogProductUsageCount(item);
      return formatCatalogProduct(item, usageCount);
    }),
  );
};

export const createCatalogProduct = async (payload: CatalogProductPayload) => {
  try {
    const normalized = normalizeCatalogProductPayload(payload);
    const item = new CatalogProduct({
      ...normalized,
      lastSeenAt: new Date(),
      sourceTags: ['manual'],
    });
    await item.validate();
    await item.save();
    const plain = item.toObject<CatalogProductDocument>();
    const usageCount = await getCatalogProductUsageCount(plain);
    return formatCatalogProduct(plain, usageCount);
  } catch (error) {
    throw mapCatalogProductError(error);
  }
};

export const updateCatalogProduct = async (
  catalogProductId: string,
  payload: CatalogProductPayload,
) => {
  isValidObjectIdOrThrow(catalogProductId, 'catalogProductId');
  try {
    const existing = await CatalogProduct.findById(catalogProductId).lean<CatalogProductDocument | null>();
    if (!existing) {
      throw new Error('Catalog product not found.');
    }

    const normalizedPayload = normalizeCatalogProductPayload(payload);
    const previousName = normalizeCatalogProductName(existing.name);
    const nextName = normalizeCatalogProductName(normalizedPayload.name);
    const nameChanged = shouldPropagateCatalogProductRename(previousName, nextName);

    if (nameChanged) {
      assertCatalogProductNameFitsWarehouse(nextName);
    }

    const item = await CatalogProduct.findByIdAndUpdate(
      catalogProductId,
      normalizedPayload,
      { returnDocument: 'after', runValidators: true },
    ).lean<CatalogProductDocument | null>();

    if (!item) throw new Error('Catalog product not found.');

    if (nameChanged) {
      await propagateCatalogProductNameChange({
        catalogProductId,
        previousName,
        nextName,
      });
    }

    const usageCount = await getCatalogProductUsageCount(item);
    return formatCatalogProduct(item, usageCount);
  } catch (error) {
    throw mapCatalogProductError(error);
  }
};

export const deleteCatalogProduct = async (catalogProductId: string) => {
  isValidObjectIdOrThrow(catalogProductId, 'catalogProductId');
  const existing = await CatalogProduct.findById(catalogProductId).lean<CatalogProductDocument | null>();
  if (!existing) throw new Error('Catalog product not found.');

  const usageCount = await getCatalogProductUsageCount(existing);
  if (usageCount > 0) {
    throw new Error('This product is used in orders or sales and cannot be removed.');
  }

  const deleted = await CatalogProduct.findByIdAndDelete(catalogProductId).lean<CatalogProductDocument | null>();
  if (!deleted) throw new Error('Catalog product not found.');
  return { id: catalogProductId };
};

export const upsertCatalogProducts = async (
  names: string[],
  sourceTag: 'order-card' | 'sales-card' | 'sales-flow',
) => {
  const normalizedNames = Array.from(
    new Set(
      names
        .map((name) => normalizeCatalogProductName(name))
        .filter((name) => name.length >= 2),
    ),
  );

  if (normalizedNames.length === 0) {
    return;
  }

  await Promise.all(
    normalizedNames.map(async (name) => {
      const existing = await CatalogProduct.findOne({ name }).collation({ locale: 'en', strength: 2 });

      if (existing) {
        existing.lastSeenAt = new Date();
        existing.sourceTags = Array.from(new Set([...(existing.sourceTags ?? []), sourceTag]));
        await existing.save();
        return;
      }

      const item = new CatalogProduct({
        name,
        note: '',
        isActive: true,
        sourceTags: [sourceTag],
        lastSeenAt: new Date(),
      });
      await item.save();
    }),
  );
};
