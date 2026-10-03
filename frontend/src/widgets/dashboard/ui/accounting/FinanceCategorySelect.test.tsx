import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../shared/i18n/config';
import type { FinanceCategory } from '../../../../entities/finance';
import { FinanceCategorySelect } from './FinanceCategorySelect';

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

describe('FinanceCategorySelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the list, keeps Other last, and exposes add action', () => {
    const onChange = vi.fn();
    const onAdd = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <FinanceCategorySelect
          categories={[
            category({ slug: 'other', sortOrder: 9999 }),
            category({ slug: 'rent', sortOrder: 110 }),
            category({
              slug: 'c_1',
              name: 'Ads',
              kind: 'custom_opex',
              isSystem: false,
              sortOrder: 200,
            }),
          ]}
          value='rent'
          canAdd
          onChange={onChange}
          onAdd={onAdd}
        />
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: i18n.t('accounting.profit.categories.rent') }));
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      i18n.t('accounting.profit.categories.rent'),
      'Ads',
      i18n.t('accounting.profit.categories.other'),
    ]);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('accounting.financeSettings.addCategory') }));
    expect(onAdd).toHaveBeenCalled();
  });
});
