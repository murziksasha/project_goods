import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../shared/i18n/config';
import type { FinanceCategory } from '../../../../entities/finance';
import { AccountingCategorySettings } from './AccountingCategorySettings';

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

describe('AccountingCategorySettings', () => {
  afterEach(() => {
    cleanup();
  });

  it('locks always-active names and lets expense categories be renamed', () => {
    const onRenameCategory = vi.fn();
    const onToggleCategoryActive = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <AccountingCategorySettings
          categories={[
            category({ slug: 'other', sortOrder: 9999 }),
            category({ slug: 'rent', sortOrder: 110 }),
            category({ slug: 'client_payment', kind: 'system_auto', sortOrder: 10 }),
            category({ slug: 'client_refund', kind: 'system_auto', sortOrder: 20 }),
            category({ slug: 'supplier_payment', kind: 'system_auto', sortOrder: 30 }),
          ]}
          isSaving={false}
          onCreateCategory={vi.fn()}
          onDeleteCategory={vi.fn()}
          onRenameCategory={onRenameCategory}
          onToggleCategoryActive={onToggleCategoryActive}
        />
      </I18nextProvider>,
    );

    const nameInputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    expect(nameInputs.map((input) => input.value)).toEqual([
      i18n.t('accounting.profit.categories.client_payment'),
      i18n.t('accounting.profit.categories.client_refund'),
      i18n.t('accounting.profit.categories.supplier_payment'),
      i18n.t('accounting.profit.categories.rent'),
      i18n.t('accounting.profit.categories.other'),
    ]);
    expect(nameInputs[0]).toBeDisabled();
    expect(nameInputs[1]).toBeDisabled();
    expect(nameInputs[2]).toBeDisabled();
    expect(nameInputs[3]).toBeEnabled();
    expect(nameInputs[4]).toBeDisabled();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeDisabled();
    expect(checkboxes[1]).toBeDisabled();
    expect(checkboxes[2]).toBeDisabled();
    expect(checkboxes[3]).toBeEnabled();
    expect(checkboxes[4]).toBeDisabled();

    const rentInput = screen.getByDisplayValue(i18n.t('accounting.profit.categories.rent'));
    expect(screen.queryByRole('button', { name: i18n.t('common.save') })).not.toBeInTheDocument();

    fireEvent.change(rentInput, { target: { value: 'Office rent' } });
    const saveButton = screen.getByRole('button', { name: i18n.t('common.save') });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    expect(onRenameCategory).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'rent' }),
      'Office rent',
    );

    onRenameCategory.mockClear();
    fireEvent.change(rentInput, { target: { value: 'HQ rent' } });
    fireEvent.blur(rentInput);
    expect(onRenameCategory).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'rent' }),
      'HQ rent',
    );

    onRenameCategory.mockClear();
    fireEvent.change(rentInput, { target: { value: 'Warehouse rent' } });
    fireEvent.keyDown(rentInput, { key: 'Enter' });
    expect(onRenameCategory).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'rent' }),
      'Warehouse rent',
    );

    onRenameCategory.mockClear();
    fireEvent.change(rentInput, { target: { value: '' } });
    expect(screen.queryByRole('button', { name: i18n.t('common.save') })).not.toBeInTheDocument();
    fireEvent.blur(rentInput);
    expect(rentInput).toHaveValue(i18n.t('accounting.profit.categories.rent'));
    expect(onRenameCategory).not.toHaveBeenCalled();

    fireEvent.click(checkboxes[3]);
    expect(onToggleCategoryActive).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'rent' }),
    );
  });

  it('deletes a used custom category and keeps system delete disabled', () => {
    const onDeleteCategory = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <AccountingCategorySettings
          categories={[
            category({
              slug: 'c_1',
              name: 'Ads',
              isSystem: false,
              kind: 'custom_opex',
              usageCount: 4,
              sortOrder: 200,
            }),
            category({ slug: 'rent', sortOrder: 110 }),
          ]}
          isSaving={false}
          onCreateCategory={vi.fn()}
          onDeleteCategory={onDeleteCategory}
          onRenameCategory={vi.fn()}
          onToggleCategoryActive={vi.fn()}
        />
      </I18nextProvider>,
    );

    const adsRow = screen.getByDisplayValue('Ads').closest('.finance-currency-activity-item');
    expect(adsRow).not.toBeNull();
    const adsDelete = within(adsRow as HTMLElement).getByRole('button', {
      name: i18n.t('accounting.financeSettings.deleteCategory'),
    });
    expect(adsDelete).toBeEnabled();
    fireEvent.click(adsDelete);
    expect(onDeleteCategory).toHaveBeenCalledWith('c_1');

    const rentRow = screen
      .getByDisplayValue(i18n.t('accounting.profit.categories.rent'))
      .closest('.finance-currency-activity-item');
    expect(rentRow).not.toBeNull();
    expect(
      within(rentRow as HTMLElement).getByRole('button', {
        name: i18n.t('accounting.financeSettings.deleteCategory'),
      }),
    ).toBeDisabled();
  });
});
