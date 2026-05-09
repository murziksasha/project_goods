import { formatCatalogProduct } from '../../shared/lib/formatters';
import { toNonEmptyString } from '../../shared/lib/parsers';
import { getSearchQuery, isValidObjectIdOrThrow } from '../../shared/lib/query';
import { CatalogProduct, type CatalogProductDocument } from './model';

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

export const listCatalogProducts = async (queryValue: unknown) => {
  const query = getSearchQuery(queryValue);
  const items = await CatalogProduct.find(query)
    .sort({ createdAt: -1 })
    .lean<CatalogProductDocument[]>();
  return items.map(formatCatalogProduct);
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
      { new: true, runValidators: true },
    ).lean<CatalogProductDocument | null>();

    if (!item) throw new Error('Catalog product not found.');

    return formatCatalogProduct(item);
  } catch (error) {
    throw mapCatalogProductError(error);
  }
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
