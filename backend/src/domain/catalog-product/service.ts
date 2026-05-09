import { formatCatalogProduct } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { CatalogProduct, type CatalogProductDocument } from './model';
import { Sale } from '../sale/model';

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

const normalizeProductName = (value: string) => value.trim().replace(/\s+/g, ' ');
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getCatalogProductUsageCount = async (item: CatalogProductDocument) => {
  const normalizedName = normalizeProductName(item.name);
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

export const updateCatalogProduct = async (
  catalogProductId: string,
  payload: CatalogProductPayload,
) => {
  isValidObjectIdOrThrow(catalogProductId, 'catalogProductId');
  try {
    const item = await CatalogProduct.findByIdAndUpdate(
      catalogProductId,
      normalizeCatalogProductPayload(payload),
      { returnDocument: 'after', runValidators: true },
    ).lean<CatalogProductDocument | null>();

    if (!item) throw new Error('Catalog product not found.');

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
        .map((name) => normalizeProductName(name))
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
