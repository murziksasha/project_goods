import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../shared/lib/errors';
import {
  createFinanceCategory,
  deleteFinanceCategory,
  listFinanceCategories,
  updateFinanceCategory,
} from './category-crud';
import { FinanceCategory, FinanceTransaction } from './model';

const store = vi.hoisted(() => ({
  categories: new Map<string, any>(),
  usageBySlug: new Map<string, number>(),
}));

const leanResult = <T>(value: T) => ({
  lean: vi.fn(async () => value),
});

const installCategorySpies = () => {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 1,
  });

  vi.spyOn(FinanceCategory, 'findOneAndUpdate').mockImplementation(
    (query: any, update: any) => {
      const slug = String(query.slug);
      let category = store.categories.get(slug);
      if (!category) {
        category = {
          _id: new mongoose.Types.ObjectId(),
          slug,
          createdAt: new Date('2026-06-01T10:00:00.000Z'),
          updatedAt: new Date('2026-06-01T10:00:00.000Z'),
          ...(update.$setOnInsert ?? {}),
        };
        store.categories.set(slug, category);
      }
      Object.assign(category, update.$set ?? {});
      return leanResult(category) as never;
    },
  );

  vi.spyOn(FinanceCategory, 'find').mockImplementation(() => {
    const results = [...store.categories.values()].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );
    return {
      sort: () => leanResult(results),
    } as never;
  });

  vi.spyOn(FinanceCategory, 'findOne').mockImplementation((query: any) => {
    if (query.name?.$regex) {
      const pattern = new RegExp(query.name.$regex, query.name.$options);
      const excludeSlug = query.slug?.$ne;
      const match = [...store.categories.values()].find(
        (category) =>
          category.slug !== excludeSlug && pattern.test(String(category.name)),
      );
      return leanResult(match ?? null) as never;
    }
    return leanResult(store.categories.get(String(query.slug)) ?? null) as never;
  });

  vi.spyOn(FinanceCategory, 'countDocuments').mockImplementation(async (query: any) => {
    if (query.kind === 'custom_opex') {
      return [...store.categories.values()].filter(
        (category) => category.kind === 'custom_opex',
      ).length;
    }
    return 0;
  });

  vi.spyOn(FinanceCategory, 'create').mockImplementation(async (payload: any) => {
    const category = {
      _id: new mongoose.Types.ObjectId(),
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
      ...payload,
    };
    store.categories.set(category.slug, category);
    return {
      toObject: () => category,
    };
  });

  vi.spyOn(FinanceCategory, 'deleteOne').mockImplementation(async (query: any) => {
    store.categories.delete(String(query.slug));
    return { deletedCount: 1 };
  });

  vi.spyOn(FinanceTransaction, 'countDocuments').mockImplementation(
    async (query: any) => store.usageBySlug.get(String(query.category)) ?? 0,
  );

  vi.spyOn(FinanceTransaction, 'updateMany').mockImplementation(
    async (query: any, update: any) => {
      const from = String(query.category);
      const to = String(update.$set?.category ?? '');
      const count = store.usageBySlug.get(from) ?? 0;
      store.usageBySlug.delete(from);
      if (to) {
        store.usageBySlug.set(to, (store.usageBySlug.get(to) ?? 0) + count);
      }
      return { modifiedCount: count };
    },
  );

  vi.spyOn(FinanceTransaction, 'aggregate').mockImplementation(async () =>
    [...store.usageBySlug.entries()].map(([slug, count]) => ({
      _id: slug,
      count,
    })),
  );
};

describe('finance category CRUD', () => {
  beforeEach(() => {
    store.categories.clear();
    store.usageBySlug.clear();
    vi.restoreAllMocks();
    installCategorySpies();
  });

  it('creates a custom category, lists it, and deletes when unused', async () => {
    const created = await createFinanceCategory({ name: '  Реклама  ' });
    expect(created.name).toBe('Реклама');
    expect(created.kind).toBe('custom_opex');
    expect(created.isActive).toBe(true);
    expect(created.slug.startsWith('c_')).toBe(true);
    expect(created.usageCount).toBe(0);

    const listed = await listFinanceCategories();
    expect(listed.some((category) => category.slug === created.slug)).toBe(true);

    await expect(deleteFinanceCategory(created.slug)).resolves.toEqual({ ok: true });
  });

  it('rejects reserved and duplicate names', async () => {
    await expect(createFinanceCategory({ name: 'Оренда' })).rejects.toBeInstanceOf(
      HttpError,
    );
    await createFinanceCategory({ name: 'Маркетинг' });
    await expect(createFinanceCategory({ name: 'маркетинг' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('cannot deactivate Other or delete system categories', async () => {
    store.categories.set('other', {
      _id: new mongoose.Types.ObjectId(),
      slug: 'other',
      name: 'Other',
      isSystem: true,
      kind: 'system_opex',
      isActive: true,
      sortOrder: 9999,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    store.categories.set('rent', {
      _id: new mongoose.Types.ObjectId(),
      slug: 'rent',
      name: 'Rent',
      isSystem: true,
      kind: 'system_opex',
      isActive: true,
      sortOrder: 110,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    await expect(
      updateFinanceCategory('other', { isActive: false }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Other category cannot be deactivated.',
    });

    await expect(deleteFinanceCategory('rent')).rejects.toMatchObject({
      statusCode: 409,
      message: 'System category cannot be deleted.',
    });
  });

  it('deletes a used custom category and reassigns transactions to Other', async () => {
    const custom = await createFinanceCategory({ name: 'Доставка' });
    store.usageBySlug.set(custom.slug, 2);

    await expect(deleteFinanceCategory(custom.slug)).resolves.toEqual({ ok: true });
    expect(store.categories.has(custom.slug)).toBe(false);
    expect(store.usageBySlug.get(custom.slug)).toBeUndefined();
    expect(store.usageBySlug.get('other')).toBe(2);
  });

  it('toggles custom activity, renames opex, and rejects always-active rename', async () => {
    const custom = await createFinanceCategory({ name: 'Бонус' });
    const updated = await updateFinanceCategory(custom.slug, { isActive: false });
    expect(updated.isActive).toBe(false);

    store.categories.set('salary', {
      _id: new mongoose.Types.ObjectId(),
      slug: 'salary',
      name: 'Salary',
      isSystem: true,
      kind: 'system_opex',
      isActive: true,
      sortOrder: 120,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    store.categories.set('client_payment', {
      _id: new mongoose.Types.ObjectId(),
      slug: 'client_payment',
      name: 'Client payment',
      isSystem: true,
      kind: 'system_auto',
      isActive: true,
      sortOrder: 10,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    });
    store.categories.set('other', {
      _id: new mongoose.Types.ObjectId(),
      slug: 'other',
      name: 'Other',
      isSystem: true,
      kind: 'system_opex',
      isActive: true,
      sortOrder: 9999,
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-01T10:00:00.000Z'),
    });

    const renamed = await updateFinanceCategory('salary', { name: 'Pay' });
    expect(renamed.name).toBe('Pay');

    const restored = await updateFinanceCategory('salary', { name: 'Зарплата' });
    expect(restored.name).toBe('Зарплата');

    await expect(
      updateFinanceCategory('client_payment', { name: 'Каса клієнта' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Always-active category cannot be renamed.',
    });

    await expect(
      updateFinanceCategory('other', { name: 'Різне' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Always-active category cannot be renamed.',
    });

    await expect(
      updateFinanceCategory('client_payment', { isActive: false }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'System category cannot be updated.',
    });

    await expect(
      updateFinanceCategory('salary', { name: 'Бонус' }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
