import mongoose from 'mongoose';
import { HttpError } from '../../shared/lib/errors';
import { escapeRegExp } from '../../shared/lib/query';
import {
  ensureFinanceCategories,
  isOwnSeededFinanceCategoryName,
  OTHER_CATEGORY_SLUG,
  reservedFinanceCategoryNames,
} from './categories';
import { formatFinanceCategory } from './formatters';
import {
  FinanceCategory,
  FinanceTransaction,
  type FinanceCategoryDocument,
} from './model';

const CATEGORY_NAME_MAX_LENGTH = 80;

export type CreateFinanceCategoryPayload = {
  name?: unknown;
};

export type UpdateFinanceCategoryPayload = {
  isActive?: unknown;
  name?: unknown;
};

const normalizeCategoryName = (value: unknown) => {
  const name = String(value ?? '').trim();
  if (name.length < 2) {
    throw new HttpError(400, 'Category name is required.');
  }
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new HttpError(
      400,
      'Category name must contain no more than 80 characters.',
    );
  }
  return name;
};

const assertNameAvailable = async (name: string, excludeSlug?: string) => {
  const normalized = name.toLowerCase();
  if (
    reservedFinanceCategoryNames.has(normalized) &&
    !(excludeSlug && isOwnSeededFinanceCategoryName(excludeSlug, name))
  ) {
    throw new HttpError(409, 'Category name already exists.');
  }

  const existing = await FinanceCategory.findOne({
    slug: excludeSlug ? { $ne: excludeSlug } : { $exists: true },
    name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
  }).lean<FinanceCategoryDocument | null>();

  if (existing) {
    throw new HttpError(409, 'Category name already exists.');
  }
};

const countCategoryUsage = async (slug: string) =>
  FinanceTransaction.countDocuments({ category: slug });

const loadUsageCounts = async (slugs: string[]) => {
  if (slugs.length === 0) return {} as Record<string, number>;
  const rows = await FinanceTransaction.aggregate<{ _id: string; count: number }>([
    { $match: { category: { $in: slugs } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
};

export const listFinanceCategories = async () => {
  await ensureFinanceCategories();
  const categories = await FinanceCategory.find()
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean<FinanceCategoryDocument[]>();
  const usageBySlug = await loadUsageCounts(categories.map((category) => category.slug));
  return categories.map((category) =>
    formatFinanceCategory(category, usageBySlug[category.slug] ?? 0),
  );
};

export const createFinanceCategory = async (
  payload: CreateFinanceCategoryPayload,
) => {
  await ensureFinanceCategories();
  const name = normalizeCategoryName(payload.name);
  await assertNameAvailable(name);

  const objectId = new mongoose.Types.ObjectId();
  const customCount = await FinanceCategory.countDocuments({ kind: 'custom_opex' });
  const created = await FinanceCategory.create({
    slug: `c_${objectId.toString()}`,
    name,
    isSystem: false,
    kind: 'custom_opex',
    isActive: true,
    sortOrder: 200 + customCount,
  });

  return formatFinanceCategory(
    created.toObject<FinanceCategoryDocument>(),
    0,
  );
};

export const updateFinanceCategory = async (
  slugPayload: unknown,
  payload: UpdateFinanceCategoryPayload,
) => {
  const slug = String(slugPayload ?? '').trim();
  if (!slug) {
    throw new HttpError(400, 'Category slug is required.');
  }

  await ensureFinanceCategories();
  const existing = await FinanceCategory.findOne({ slug }).lean<
    FinanceCategoryDocument | null
  >();
  if (!existing) {
    throw new HttpError(404, 'Category not found.');
  }

  const patch: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    if (existing.kind === 'system_auto' || slug === OTHER_CATEGORY_SLUG) {
      throw new HttpError(400, 'Always-active category cannot be renamed.');
    }
    const name = normalizeCategoryName(payload.name);
    await assertNameAvailable(name, slug);
    patch.name = name;
  }

  if (payload.isActive !== undefined) {
    const isActive = Boolean(payload.isActive);
    if (existing.kind === 'system_auto') {
      throw new HttpError(400, 'System category cannot be updated.');
    }
    if (slug === OTHER_CATEGORY_SLUG && !isActive) {
      throw new HttpError(400, 'Other category cannot be deactivated.');
    }
    patch.isActive = isActive;
  }

  if (Object.keys(patch).length === 0) {
    const usageCount = await countCategoryUsage(slug);
    return formatFinanceCategory(existing, usageCount);
  }

  const updated = await FinanceCategory.findOneAndUpdate(
    { slug },
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  ).lean<FinanceCategoryDocument | null>();
  if (!updated) {
    throw new HttpError(404, 'Category not found.');
  }

  const usageCount = await countCategoryUsage(slug);
  return formatFinanceCategory(updated, usageCount);
};

export const deleteFinanceCategory = async (slugPayload: unknown) => {
  const slug = String(slugPayload ?? '').trim();
  if (!slug) {
    throw new HttpError(400, 'Category slug is required.');
  }

  const existing = await FinanceCategory.findOne({ slug }).lean<
    FinanceCategoryDocument | null
  >();
  if (!existing) {
    throw new HttpError(404, 'Category not found.');
  }
  if (existing.isSystem) {
    throw new HttpError(409, 'System category cannot be deleted.');
  }

  await FinanceTransaction.updateMany(
    { category: slug },
    { $set: { category: OTHER_CATEGORY_SLUG } },
  );
  await FinanceCategory.deleteOne({ slug });
  return { ok: true as const };
};
