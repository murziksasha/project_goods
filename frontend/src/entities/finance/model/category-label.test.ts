import { describe, expect, it } from 'vitest';
import type { FinanceCategory } from './types';
import {
  foldOpexCategoryIntoOther,
  foldUnknownOpexCategories,
  getFinanceCategoryLabel,
  getSettingsFinanceCategories,
  getWithdrawDropdownCategories,
  isAlwaysActiveFinanceCategory,
  isDefaultFinanceCategoryName,
  shouldShowWithdrawCategorySubtitle,
  toFinanceCategoryStoredName,
  withFallbackWithdrawCategories,
} from './category-label';

const t = ((key: string) => key) as never;

const category = (patch: Partial<FinanceCategory>): FinanceCategory => {
  const slug = patch.slug ?? 'rent';
  return {
    id: slug,
    isSystem: true,
    kind: 'system_opex',
    isActive: true,
    sortOrder: 110,
    usageCount: 0,
    createdAt: '',
    updatedAt: '',
    ...patch,
    slug,
    name: patch.name ?? slug,
  };
};

describe('finance category labels', () => {
  it('uses i18n for default system names and stored name when renamed', () => {
    expect(getFinanceCategoryLabel('rent', t)).toBe('accounting.profit.categories.rent');
    expect(
      getFinanceCategoryLabel('rent', t, [category({ slug: 'rent', name: 'Rent' })]),
    ).toBe('accounting.profit.categories.rent');
    expect(
      getFinanceCategoryLabel('rent', t, [
        category({ slug: 'rent', name: 'Office rent' }),
      ]),
    ).toBe('Office rent');
    expect(
      getFinanceCategoryLabel('c_1', t, [
        category({ slug: 'c_1', name: 'Ads', kind: 'custom_opex', isSystem: false }),
      ]),
    ).toBe('Ads');
    expect(isDefaultFinanceCategoryName('rent', 'Оренда')).toBe(true);
    expect(toFinanceCategoryStoredName('rent', 'Оренда', t)).toBe('Rent');
    expect(toFinanceCategoryStoredName('rent', 'Office rent', t)).toBe('Office rent');
  });

  it('hides Other subtitle on withdraw rows and skips deposits', () => {
    expect(
      shouldShowWithdrawCategorySubtitle({ type: 'withdraw', category: 'rent' }),
    ).toBe(true);
    expect(
      shouldShowWithdrawCategorySubtitle({ type: 'withdraw', category: 'other' }),
    ).toBe(false);
    expect(
      shouldShowWithdrawCategorySubtitle({ type: 'deposit', category: 'client_payment' }),
    ).toBe(false);
  });

  it('keeps Other last and includes auto categories in settings', () => {
    const rows = [
      category({ slug: 'other', sortOrder: 9999 }),
      category({ slug: 'custom', kind: 'custom_opex', isSystem: false, sortOrder: 200 }),
      category({ slug: 'client_payment', kind: 'system_auto', sortOrder: 10 }),
      category({ slug: 'client_refund', kind: 'system_auto', sortOrder: 20 }),
      category({ slug: 'supplier_payment', kind: 'system_auto', sortOrder: 30 }),
      category({ slug: 'rent', sortOrder: 110, isActive: false }),
    ];
    expect(getWithdrawDropdownCategories(rows).map((item) => item.slug)).toEqual([
      'custom',
      'other',
    ]);
    expect(getSettingsFinanceCategories(rows).map((item) => item.slug)).toEqual([
      'client_payment',
      'client_refund',
      'supplier_payment',
      'rent',
      'custom',
      'other',
    ]);
    expect(isAlwaysActiveFinanceCategory(rows[2])).toBe(true);
    expect(isAlwaysActiveFinanceCategory(rows[0])).toBe(true);
    expect(isAlwaysActiveFinanceCategory(rows[5])).toBe(false);
  });

  it('falls back to system opex when the API list is empty', () => {
    expect(withFallbackWithdrawCategories([]).map((item) => item.slug)).toContain('other');
  });

  it('moves deleted custom opex amounts into Other', () => {
    expect(
      foldOpexCategoryIntoOther(
        [
          { category: 'c_1', amount: 1, count: 1 },
          { category: 'other', amount: 50, count: 1 },
          { category: 'rent', amount: 50, count: 1 },
        ],
        'c_1',
      ),
    ).toEqual([
      { category: 'other', amount: 51, count: 2 },
      { category: 'rent', amount: 50, count: 1 },
    ]);
    expect(
      foldUnknownOpexCategories(
        [
          { category: 'c_1', amount: 1, count: 1 },
          { category: 'other', amount: 50, count: 1 },
          { category: 'utilities', amount: 100, count: 1 },
        ],
        ['other', 'utilities'],
      ),
    ).toEqual([
      { category: 'other', amount: 51, count: 2 },
      { category: 'utilities', amount: 100, count: 1 },
    ]);
  });
});
