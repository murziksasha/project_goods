import mongoose from 'mongoose';
import { formatCatalogProduct } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import {
  getSearchQuery,
  isValidObjectIdOrThrow,
} from '../../shared/lib/query';
import { CatalogProduct, type CatalogProductDocument } from './model';
import {
  assertCatalogProductNameFitsWarehouse,
  buildCatalogLineItemNamePattern,
  buildCatalogSnapshotNamePattern,
  catalogProductNamesAreEqual,
  matchesCatalogLineItemProductName,
  matchesCatalogSnapshotProductName,
  normalizeCatalogProductName,
  renameSaleForCatalogProduct,
  renameSupplierOrderItems,
  shouldPropagateCatalogProductRename,
} from './name-propagation';
import { Product } from '../product/model';
import { getExactProductModelNameQuery } from '../product/service';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';
import { HttpError } from '../../shared/lib/errors';
import { withOptionalMongoSession } from '../../shared/lib/mongo-session';
import { mergeNotes } from '../shared/merge-notes';

export type CatalogProductPayload = {
  name?: unknown;
  note?: unknown;
  isActive?: unknown;
};

const normalizeCatalogProductPayload = (
  payload: CatalogProductPayload,
) => ({
  name: toNonEmptyString(payload.name),
  note: toNonEmptyString(payload.note),
  isActive:
    payload.isActive === undefined
      ? true
      : payload.isActive === true ||
        String(payload.isActive).toLowerCase() === 'true',
});

const mapCatalogProductError = (error: unknown) => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  ) {
    return new Error(
      'Catalog product with this name already exists.',
    );
  }
  return error;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const normalizedPreviousName =
    normalizeCatalogProductName(previousName);
  const normalizedNextName = normalizeCatalogProductName(nextName);

  if (
    !shouldPropagateCatalogProductRename(
      normalizedPreviousName,
      normalizedNextName,
    )
  ) {
    return;
  }

  assertCatalogProductNameFitsWarehouse(normalizedNextName);

  const catalogObjectId = new mongoose.Types.ObjectId(
    catalogProductId,
  );
  const products = await Product.find(
    getExactProductModelNameQuery(normalizedPreviousName),
  );
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
          $regex: buildCatalogSnapshotNamePattern(
            normalizedPreviousName,
          ),
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

    if (
      JSON.stringify(nextItems) === JSON.stringify(order.items ?? [])
    ) {
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
          $regex: buildCatalogSnapshotNamePattern(
            normalizedPreviousName,
          ),
          $options: 'i',
        },
      },
      {
        'lineItems.name': {
          $regex: buildCatalogLineItemNamePattern(
            normalizedPreviousName,
          ),
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
                serialNumber:
                  sale.productSnapshot?.serialNumber ?? '',
              },
            }
          : {}),
        ...(lineItemsChanged ? { lineItems: nextLineItems } : {}),
      });
    }),
  );
};

type SaleUsageFields = {
  productSnapshot?: { name?: string | null } | null;
  lineItems?: Array<{ name?: string | null }> | null;
  note?: string | null;
};

const loadSalesForCatalogUsage = () =>
  Sale.find({}, { productSnapshot: 1, lineItems: 1, note: 1 }).lean<
    SaleUsageFields[]
  >();

const countCatalogProductUsageInSales = (
  item: CatalogProductDocument,
  sales: SaleUsageFields[],
) => {
  const normalizedName = normalizeCatalogProductName(item.name);
  if (!normalizedName) return 0;

  const normalizedNamePattern = escapeRegExp(normalizedName).replace(
    /\s+/g,
    '\\s+',
  );
  const snapshotRe = new RegExp(`^${normalizedNamePattern}$`, 'i');
  const lineItemRe = new RegExp(
    `^${normalizedNamePattern}(?:\\s*\\(.*\\))?$`,
    'i',
  );
  const noteRe = new RegExp(escapeRegExp(normalizedName), 'i');

  return sales.reduce((count, sale) => {
    if (snapshotRe.test(String(sale.productSnapshot?.name ?? ''))) {
      return count + 1;
    }
    if (
      (sale.lineItems ?? []).some((line) =>
        lineItemRe.test(String(line.name ?? '')),
      )
    ) {
      return count + 1;
    }
    if (noteRe.test(String(sale.note ?? ''))) {
      return count + 1;
    }
    return count;
  }, 0);
};

const getCatalogProductUsageCount = async (
  item: CatalogProductDocument,
) => {
  const sales = await loadSalesForCatalogUsage();
  return countCatalogProductUsageInSales(item, sales);
};

export const listCatalogProducts = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const [items, sales] = await Promise.all([
    CatalogProduct.find(query)
      .sort({ createdAt: -1 })
      .lean<CatalogProductDocument[]>(),
    loadSalesForCatalogUsage(),
  ]);
  return items.map((item) =>
    formatCatalogProduct(
      item,
      countCatalogProductUsageInSales(item, sales),
    ),
  );
};

export const createCatalogProduct = async (
  payload: CatalogProductPayload,
) => {
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
    // Document save (not findByIdAndUpdate) so pre('validate') rebuilds searchText.
    // findByIdAndUpdate skips middleware → stale searchText → supplier-order suggestions miss renames.
    const item = await CatalogProduct.findById(catalogProductId);
    if (!item) {
      throw new HttpError(404, 'Catalog product not found.');
    }

    const normalizedPayload = normalizeCatalogProductPayload(payload);
    const previousName = normalizeCatalogProductName(item.name);
    const nextName = normalizeCatalogProductName(
      normalizedPayload.name,
    );
    const nameChanged = shouldPropagateCatalogProductRename(
      previousName,
      nextName,
    );

    if (nameChanged) {
      assertCatalogProductNameFitsWarehouse(nextName);
    }

    item.name = normalizedPayload.name;
    item.note = normalizedPayload.note;
    item.isActive = normalizedPayload.isActive;

    await item.validate();
    await item.save();

    if (nameChanged) {
      await propagateCatalogProductNameChange({
        catalogProductId,
        previousName,
        nextName,
      });
    }

    const plain = item.toObject<CatalogProductDocument>();
    const usageCount = await getCatalogProductUsageCount(plain);
    return formatCatalogProduct(plain, usageCount);
  } catch (error) {
    throw mapCatalogProductError(error);
  }
};

/** Recompute searchText for all catalog products (fixes stale index after renames via old update path). */
export const rebuildCatalogProductSearchTexts = async () => {
  const items = await CatalogProduct.find({});
  let updated = 0;
  let alreadyConsistent = 0;

  for (const item of items) {
    const expected = [item.name, item.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if ((item.searchText ?? '') === expected) {
      alreadyConsistent += 1;
      continue;
    }
    await item.validate();
    await item.save();
    updated += 1;
  }

  return { scanned: items.length, updated, alreadyConsistent };
};

export const deleteCatalogProduct = async (
  catalogProductId: string,
) => {
  isValidObjectIdOrThrow(catalogProductId, 'catalogProductId');
  const existing = await CatalogProduct.findById(
    catalogProductId,
  ).lean<CatalogProductDocument | null>();
  if (!existing)
    throw new HttpError(404, 'Catalog product not found.');

  const usageCount = await getCatalogProductUsageCount(existing);
  if (usageCount > 0) {
    throw new HttpError(
      400,
      'This product is used in orders or sales and cannot be removed.',
    );
  }

  const deleted = await CatalogProduct.findByIdAndDelete(
    catalogProductId,
  ).lean<CatalogProductDocument | null>();
  if (!deleted)
    throw new HttpError(404, 'Catalog product not found.');
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
      const existing = await CatalogProduct.findOne({
        name,
      }).collation({ locale: 'en', strength: 2 });

      if (existing) {
        existing.lastSeenAt = new Date();
        existing.sourceTags = Array.from(
          new Set([...(existing.sourceTags ?? []), sourceTag]),
        );
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

export const mergeCatalogProducts = async (
  targetCatalogProductIdInput: unknown,
  sourceCatalogProductIdInput: unknown,
  draftNoteInput?: unknown,
) => {
  const targetCatalogProductId =
    typeof targetCatalogProductIdInput === 'string'
      ? targetCatalogProductIdInput.trim()
      : '';
  const sourceCatalogProductId =
    typeof sourceCatalogProductIdInput === 'string'
      ? sourceCatalogProductIdInput.trim()
      : '';
  const draftNote =
    typeof draftNoteInput === 'string' ? draftNoteInput.trim() : '';

  if (!targetCatalogProductId || !sourceCatalogProductId) {
    throw new HttpError(
      400,
      'Both targetCatalogProductId and sourceCatalogProductId are required.',
    );
  }
  if (targetCatalogProductId === sourceCatalogProductId) {
    throw new HttpError(
      400,
      'Select two different catalog products.',
    );
  }

  isValidObjectIdOrThrow(
    targetCatalogProductId,
    'targetCatalogProductId',
  );
  isValidObjectIdOrThrow(
    sourceCatalogProductId,
    'sourceCatalogProductId',
  );

  return withOptionalMongoSession(async (session) => {
    const [targetProduct, sourceProduct] = await Promise.all([
      CatalogProduct.findById(targetCatalogProductId, null, {
        session: session ?? undefined,
      }),
      CatalogProduct.findById(sourceCatalogProductId, null, {
        session: session ?? undefined,
      }),
    ]);

    if (!targetProduct) {
      throw new HttpError(404, 'Target catalog product not found.');
    }
    if (!sourceProduct) {
      throw new HttpError(404, 'Source catalog product not found.');
    }

    const sourceName = sourceProduct.name;
    const targetName = targetProduct.name;
    const sourceObjectId = sourceProduct._id;
    const targetObjectId = targetProduct._id;

    const mergedNote = mergeNotes(
      targetProduct.note,
      sourceProduct.note,
      draftNote,
    );
    const mergedSourceTags = Array.from(
      new Set([
        ...(targetProduct.sourceTags ?? []),
        ...(sourceProduct.sourceTags ?? []),
      ]),
    );
    const targetLastSeen = targetProduct.lastSeenAt
      ? new Date(targetProduct.lastSeenAt).getTime()
      : 0;
    const sourceLastSeen = sourceProduct.lastSeenAt
      ? new Date(sourceProduct.lastSeenAt).getTime()
      : 0;
    const latestLastSeenAt = new Date(
      Math.max(targetLastSeen, sourceLastSeen, Date.now()),
    );

    // 1. Relink matching product stock items in warehouse
    const products = await Product.find(
      getExactProductModelNameQuery(
        normalizeCatalogProductName(sourceName),
      ),
      null,
      { session: session ?? undefined },
    );
    const matchingProducts = products.filter((p) =>
      catalogProductNamesAreEqual(p.name, sourceName),
    );
    for (const prod of matchingProducts) {
      prod.name = targetName;
      await prod.validate();
      await prod.save({ session: session ?? undefined });
    }

    // 2. Relink supplier orders
    const supplierOrders = await SupplierOrder.find(
      {
        $or: [
          { 'items.catalogProductId': sourceObjectId },
          {
            'items.productName': {
              $regex: buildCatalogSnapshotNamePattern(sourceName),
              $options: 'i',
            },
          },
        ],
      },
      null,
      { session: session ?? undefined },
    );

    let relinkedSupplierOrdersCount = 0;
    for (const order of supplierOrders) {
      let orderChanged = false;
      const nextItems = (order.items ?? []).map((item) => {
        const matchesById =
          item.catalogProductId?.toString() ===
          sourceCatalogProductId;
        const matchesByName = catalogProductNamesAreEqual(
          item.productName,
          sourceName,
        );
        if (!matchesById && !matchesByName) {
          return item;
        }
        orderChanged = true;
        return {
          ...item,
          catalogProductId: targetObjectId,
          productName: targetName,
        };
      });

      if (orderChanged) {
        order.set('items', nextItems);
        await order.validate();
        await order.save({ session: session ?? undefined });
        relinkedSupplierOrdersCount += 1;
      }
    }

    // 3. Relink sales
    const linkedSales = await Sale.find(
      {
        $or: [
          { 'lineItems.catalogProductId': sourceObjectId },
          {
            'productSnapshot.name': {
              $regex: buildCatalogSnapshotNamePattern(sourceName),
              $options: 'i',
            },
          },
          {
            'lineItems.name': {
              $regex: buildCatalogLineItemNamePattern(sourceName),
              $options: 'i',
            },
          },
        ],
      },
      null,
      { session: session ?? undefined },
    ).lean();

    for (const sale of linkedSales) {
      const snapshotName = sale.productSnapshot?.name ?? '';
      const nextSnapshotName = matchesCatalogSnapshotProductName(
        snapshotName,
        sourceName,
      )
        ? targetName
        : snapshotName;

      const nextLineItems = (sale.lineItems ?? []).map((item) => {
        if (item.kind !== 'product') {
          return item;
        }
        const matchesById =
          item.catalogProductId?.toString() ===
          sourceCatalogProductId;
        const matchesByName = matchesCatalogLineItemProductName(
          item.name,
          sourceName,
        );
        if (!matchesById && !matchesByName) {
          return item;
        }
        return {
          ...item,
          catalogProductId: targetObjectId,
          name: targetName,
        };
      });

      await Sale.findByIdAndUpdate(
        sale._id,
        {
          ...(nextSnapshotName !== snapshotName
            ? {
                productSnapshot: {
                  article: sale.productSnapshot?.article ?? '',
                  name: nextSnapshotName,
                  serialNumber:
                    sale.productSnapshot?.serialNumber ?? '',
                },
              }
            : {}),
          lineItems: nextLineItems,
        },
        { session: session ?? undefined },
      );
    }

    // 4. Update target catalog product
    targetProduct.note = mergedNote;
    targetProduct.sourceTags = mergedSourceTags;
    targetProduct.lastSeenAt = latestLastSeenAt;
    await targetProduct.validate();
    await targetProduct.save({ session: session ?? undefined });

    // 5. Delete source catalog product
    const deleted = await CatalogProduct.findByIdAndDelete(
      sourceCatalogProductId,
      {
        session: session ?? undefined,
      },
    ).lean<CatalogProductDocument | null>();

    if (!deleted) {
      throw new HttpError(
        500,
        'Failed to delete source catalog product.',
      );
    }

    const plainTarget =
      targetProduct.toObject<CatalogProductDocument>();
    const usageCount = await getCatalogProductUsageCount(plainTarget);

    return {
      catalogProduct: formatCatalogProduct(plainTarget, usageCount),
      removedCatalogProductId: sourceCatalogProductId,
      relinkedSalesCount: linkedSales.length,
      relinkedSupplierOrdersCount,
      relinkedStockProductsCount: matchingProducts.length,
    };
  });
};
