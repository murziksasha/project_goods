import mongoose from 'mongoose';
import { HttpError } from '../../shared/lib/errors';
import {
  customFinanceCategorySlugPattern,
  financeTransactionCategories,
  FinanceCategory,
  OTHER_CATEGORY_SLUG,
  type FinanceCategoryDocument,
  type FinanceCategoryKind,
  type FinanceTransactionCategory,
  type TransactionType,
} from './model';

export { financeTransactionCategories, OTHER_CATEGORY_SLUG };
export type { FinanceTransactionCategory };

export const manualWithdrawCategories = [
  'rent',
  'salary',
  'utilities',
  'tax',
  'owner_draw',
  'other',
] as const;

export type ManualWithdrawCategory = (typeof manualWithdrawCategories)[number];

export type SeededFinanceCategory = {
  slug: FinanceTransactionCategory;
  name: string;
  kind: Exclude<FinanceCategoryKind, 'custom_opex'>;
  sortOrder: number;
  isActive: true;
  isSystem: true;
};

export const seededFinanceCategories: readonly SeededFinanceCategory[] = [
  {
    slug: 'client_payment',
    name: 'Client payment',
    kind: 'system_auto',
    sortOrder: 10,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'client_refund',
    name: 'Client refund',
    kind: 'system_auto',
    sortOrder: 20,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'supplier_payment',
    name: 'Supplier payment',
    kind: 'system_auto',
    sortOrder: 30,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'rent',
    name: 'Rent',
    kind: 'system_opex',
    sortOrder: 110,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'salary',
    name: 'Salary',
    kind: 'system_opex',
    sortOrder: 120,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'utilities',
    name: 'Utilities',
    kind: 'system_opex',
    sortOrder: 130,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'tax',
    name: 'Tax',
    kind: 'system_opex',
    sortOrder: 140,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'owner_draw',
    name: 'Owner draw',
    kind: 'system_opex',
    sortOrder: 150,
    isActive: true,
    isSystem: true,
  },
  {
    slug: 'other',
    name: 'Other',
    kind: 'system_opex',
    sortOrder: 9999,
    isActive: true,
    isSystem: true,
  },
];

const seededFinanceCategoryBySlug = Object.fromEntries(
  seededFinanceCategories.map((category) => [category.slug, category]),
) as Record<FinanceTransactionCategory, SeededFinanceCategory>;

export const seededFinanceCategoryAliases: Record<
  FinanceTransactionCategory,
  readonly string[]
> = {
  client_payment: ['client_payment', 'client payment', 'оплата клієнта'],
  client_refund: ['client_refund', 'client refund', 'повернення клієнту'],
  supplier_payment: ['supplier_payment', 'supplier payment', 'оплата постачальнику'],
  rent: ['rent', 'оренда'],
  salary: ['salary', 'зарплата'],
  utilities: ['utilities', 'комуналка'],
  tax: ['tax', 'податки'],
  owner_draw: ['owner_draw', 'owner draw', 'видача власнику'],
  other: ['other', 'інше'],
};

const normalizeCategoryAlias = (value: string) => value.trim().toLowerCase();

export const reservedFinanceCategoryNames = new Set(
  [
    ...seededFinanceCategories.map((category) => category.slug),
    ...seededFinanceCategories.map((category) => category.name),
    ...Object.values(seededFinanceCategoryAliases).flat(),
  ].map(normalizeCategoryAlias),
);

export const isOwnSeededFinanceCategoryName = (slug: string, name: string) => {
  const normalized = normalizeCategoryAlias(name);
  const seeded = seededFinanceCategoryBySlug[slug as FinanceTransactionCategory];
  if (!seeded) return false;
  if (normalizeCategoryAlias(seeded.slug) === normalized) return true;
  if (normalizeCategoryAlias(seeded.name) === normalized) return true;
  return (seededFinanceCategoryAliases[seeded.slug] ?? []).some(
    (alias) => normalizeCategoryAlias(alias) === normalized,
  );
};

const CLIENT_PAYMENT_NOTE =
  /^(?:Payment for order|Оплата (?:за )?замовлення)\s+/iu;
const SUPPLIER_PAYMENT_NOTE = /^Supplier order payment:/i;
const REFUND_NOTE =
  /^(?:Refund for order|Serial return for sale|Full return for sale|Return for sale)\s+/i;

export const isFinanceTransactionCategory = (
  value: unknown,
): value is FinanceTransactionCategory =>
  typeof value === 'string' &&
  financeTransactionCategories.includes(value as FinanceTransactionCategory);

export const isCustomFinanceCategorySlug = (value: string) =>
  customFinanceCategorySlugPattern.test(value);

export const isFinanceCategorySlug = (value: unknown): value is string =>
  typeof value === 'string' &&
  (isFinanceTransactionCategory(value) || isCustomFinanceCategorySlug(value));

export const normalizeOptionalCategory = (
  value: unknown,
): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isFinanceCategorySlug(value)) {
    throw new HttpError(400, 'Unsupported finance transaction category.');
  }
  return value;
};

export const inferFinanceTransactionCategory = (
  type: TransactionType,
  note: string,
): FinanceTransactionCategory | undefined => {
  if (type === 'transfer') return undefined;
  const trimmed = String(note ?? '').trim();

  if (type === 'deposit') {
    return CLIENT_PAYMENT_NOTE.test(trimmed) ? 'client_payment' : 'other';
  }

  if (REFUND_NOTE.test(trimmed)) return 'client_refund';
  if (SUPPLIER_PAYMENT_NOTE.test(trimmed) || CLIENT_PAYMENT_NOTE.test(trimmed)) {
    return 'supplier_payment';
  }
  return 'other';
};

type CategoryMeta = {
  slug: string;
  kind: FinanceCategoryKind;
  isActive: boolean;
};

const lookupStoredCategory = async (
  slug: string,
  session?: mongoose.ClientSession,
): Promise<FinanceCategoryDocument | null> => {
  const query = FinanceCategory.findOne({ slug });
  if (session && query.session) {
    return query.session(session).lean<FinanceCategoryDocument | null>();
  }
  return query.lean<FinanceCategoryDocument | null>();
};

export const getFinanceCategoryMeta = async (
  slug: string,
  session?: mongoose.ClientSession,
): Promise<CategoryMeta> => {
  const seeded = seededFinanceCategoryBySlug[slug as FinanceTransactionCategory];
  const shouldQuery =
    !seeded || mongoose.connection.readyState === 1 || Boolean(session);

  if (shouldQuery) {
    const stored = await lookupStoredCategory(slug, session);
    if (stored) {
      return {
        slug: stored.slug,
        kind: stored.kind,
        isActive: stored.isActive,
      };
    }
  }

  if (seeded) {
    return {
      slug: seeded.slug,
      kind: seeded.kind,
      isActive: seeded.isActive,
    };
  }

  throw new HttpError(400, 'Unsupported finance transaction category.');
};

export const assertCategoryWritable = async (
  type: TransactionType,
  slug: string,
  session?: mongoose.ClientSession,
) => {
  const meta = await getFinanceCategoryMeta(slug, session);

  if (type === 'deposit') {
    if (slug !== 'client_payment' && slug !== OTHER_CATEGORY_SLUG) {
      throw new HttpError(400, 'Unsupported finance transaction category.');
    }
    return;
  }

  if (type === 'withdraw') {
    if (meta.kind === 'system_auto') {
      if (slug === 'client_refund' || slug === 'supplier_payment') return;
      throw new HttpError(400, 'Unsupported finance transaction category.');
    }
    if (slug !== OTHER_CATEGORY_SLUG && meta.isActive === false) {
      throw new HttpError(400, 'Inactive finance transaction category.');
    }
    return;
  }

  throw new HttpError(400, 'Unsupported finance transaction category.');
};

export const resolveFinanceTransactionCategory = async (
  type: TransactionType,
  note: string,
  explicit?: unknown,
  session?: mongoose.ClientSession,
): Promise<string | undefined> => {
  if (type === 'transfer') return undefined;
  const slug =
    normalizeOptionalCategory(explicit) ??
    inferFinanceTransactionCategory(type, note) ??
    OTHER_CATEGORY_SLUG;
  await assertCategoryWritable(type, slug, session);
  return slug;
};

export const ensureFinanceCategories = async (
  session?: mongoose.ClientSession,
) => {
  if (mongoose.connection.readyState !== 1 && !session) return;

  await Promise.all(
    seededFinanceCategories.map((category) => {
      const op = FinanceCategory.findOneAndUpdate(
        { slug: category.slug },
        {
          $setOnInsert: {
            slug: category.slug,
            name: category.name,
            isSystem: true,
            kind: category.kind,
            isActive: true,
            sortOrder: category.sortOrder,
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      ) as mongoose.Query<FinanceCategoryDocument | null, FinanceCategoryDocument>;
      return session ? op.session(session) : op;
    }),
  );
};
