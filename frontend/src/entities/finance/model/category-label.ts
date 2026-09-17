import type { TFunction } from 'i18next';
import {
  financeTransactionCategories,
  manualWithdrawCategories,
  OTHER_CATEGORY_SLUG,
  type FinanceCategory,
  type FinanceTransaction,
  type SystemFinanceTransactionCategory,
} from './types';

const fallbackOpexCategories: FinanceCategory[] = manualWithdrawCategories.map(
  (slug, index) => ({
    id: slug,
    slug,
    name: slug,
    isSystem: true,
    kind: 'system_opex',
    isActive: true,
    sortOrder: slug === OTHER_CATEGORY_SLUG ? 9999 : 110 + index * 10,
    usageCount: 0,
    createdAt: '',
    updatedAt: '',
  }),
);

export const withFallbackWithdrawCategories = (categories: FinanceCategory[]) =>
  categories.some(
    (category) =>
      category.kind === 'system_opex' || category.kind === 'custom_opex',
  )
    ? categories
    : fallbackOpexCategories;

export const isSystemFinanceCategorySlug = (
  slug: string,
): slug is SystemFinanceTransactionCategory =>
  financeTransactionCategories.includes(slug as SystemFinanceTransactionCategory);

export const seededFinanceCategoryNames: Record<
  SystemFinanceTransactionCategory,
  string
> = {
  client_payment: 'Client payment',
  client_refund: 'Client refund',
  supplier_payment: 'Supplier payment',
  rent: 'Rent',
  salary: 'Salary',
  utilities: 'Utilities',
  tax: 'Tax',
  owner_draw: 'Owner draw',
  other: 'Other',
};

const seededFinanceCategoryAliases: Record<
  SystemFinanceTransactionCategory,
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

export const isDefaultFinanceCategoryName = (slug: string, name: string) => {
  if (!isSystemFinanceCategorySlug(slug)) return false;
  const normalized = normalizeCategoryAlias(name);
  if (normalizeCategoryAlias(seededFinanceCategoryNames[slug]) === normalized) {
    return true;
  }
  return seededFinanceCategoryAliases[slug].some(
    (alias) => normalizeCategoryAlias(alias) === normalized,
  );
};

export const getFinanceCategoryLabel = (
  slug: string,
  t: TFunction,
  categories: FinanceCategory[] = [],
) => {
  const stored = categories.find((category) => category.slug === slug)?.name;
  if (isSystemFinanceCategorySlug(slug)) {
    const i18nLabel = t(`accounting.profit.categories.${slug}`);
    if (!stored || isDefaultFinanceCategoryName(slug, stored) || stored === i18nLabel) {
      return i18nLabel;
    }
    return stored;
  }
  return stored ?? slug;
};

export const toFinanceCategoryStoredName = (
  slug: string,
  typedName: string,
  t: TFunction,
) => {
  const trimmed = typedName.trim();
  if (
    isSystemFinanceCategorySlug(slug) &&
    (trimmed === t(`accounting.profit.categories.${slug}`) ||
      isDefaultFinanceCategoryName(slug, trimmed))
  ) {
    return seededFinanceCategoryNames[slug];
  }
  return trimmed;
};

export const shouldShowWithdrawCategorySubtitle = (
  transaction: Pick<FinanceTransaction, 'type' | 'category'>,
) =>
  transaction.type === 'withdraw' &&
  Boolean(transaction.category) &&
  transaction.category !== OTHER_CATEGORY_SLUG;

const compareFinanceCategoryOrder = (
  left: FinanceCategory,
  right: FinanceCategory,
) => {
  if (left.slug === OTHER_CATEGORY_SLUG) return 1;
  if (right.slug === OTHER_CATEGORY_SLUG) return -1;
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
};

export const isAlwaysActiveFinanceCategory = (
  category: Pick<FinanceCategory, 'kind' | 'slug'>,
) => category.kind === 'system_auto' || category.slug === OTHER_CATEGORY_SLUG;

export const getWithdrawDropdownCategories = (categories: FinanceCategory[]) =>
  categories
    .filter(
      (category) =>
        category.isActive &&
        (category.kind === 'system_opex' || category.kind === 'custom_opex'),
    )
    .sort(compareFinanceCategoryOrder);

export const getSettingsFinanceCategories = (categories: FinanceCategory[]) =>
  [...categories].sort(compareFinanceCategoryOrder);

export const getTransactionFilterCategories = (categories: FinanceCategory[]) =>
  [...categories].sort(compareFinanceCategoryOrder);

const roundOpexAmount = (value: number) => Math.round(value * 100) / 100;

type OpexCategoryRow = {
  category: string;
  amount: number;
  count: number;
};

const mergeOpexCategoryRows = (
  rows: OpexCategoryRow[],
  mapSlug: (slug: string) => string,
): OpexCategoryRow[] => {
  const merged = new Map<string, OpexCategoryRow>();
  rows.forEach((row) => {
    const category = mapSlug(row.category);
    const current = merged.get(category);
    if (current) {
      current.amount = roundOpexAmount(current.amount + row.amount);
      current.count += row.count;
      return;
    }
    merged.set(category, {
      category,
      amount: row.amount,
      count: row.count,
    });
  });
  return [...merged.values()];
};

export const foldOpexCategoryIntoOther = (
  rows: OpexCategoryRow[],
  fromSlug: string,
) =>
  mergeOpexCategoryRows(rows, (slug) =>
    slug === fromSlug ? OTHER_CATEGORY_SLUG : slug,
  );

export const foldUnknownOpexCategories = (
  rows: OpexCategoryRow[],
  knownSlugs: Iterable<string>,
) => {
  const known = new Set(knownSlugs);
  financeTransactionCategories.forEach((slug) => known.add(slug));
  return mergeOpexCategoryRows(rows, (slug) =>
    known.has(slug) ? slug : OTHER_CATEGORY_SLUG,
  );
};
