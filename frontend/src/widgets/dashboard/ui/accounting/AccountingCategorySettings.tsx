import type React from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FinanceCategory } from '../../../../entities/finance';
import { OTHER_CATEGORY_SLUG } from '../../../../entities/finance';
import {
  getFinanceCategoryLabel,
  getSettingsFinanceCategories,
  isAlwaysActiveFinanceCategory,
  toFinanceCategoryStoredName,
} from '../../../../entities/finance';
import { CreateFinanceCategoryModal } from './CreateFinanceCategoryModal';

export interface AccountingCategorySettingsProps {
  categories: FinanceCategory[];
  isSaving: boolean;
  onCreateCategory: (name: string) => Promise<unknown>;
  onDeleteCategory: (slug: string) => void;
  onRenameCategory: (category: FinanceCategory, name: string) => void;
  onToggleCategoryActive: (category: FinanceCategory) => void;
};

export const AccountingCategorySettings: React.FC<AccountingCategorySettingsProps> = ({
  categories,
  isSaving,
  onCreateCategory,
  onDeleteCategory,
  onRenameCategory,
  onToggleCategoryActive,
}) => {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const rows = getSettingsFinanceCategories(categories);

  return (
    <div className='finance-settings-body'>
      <div className='finance-category-settings-toolbar'>
        <button
          type='button'
          className='primary-button'
          disabled={isSaving}
          onClick={() => setIsCreateOpen(true)}
        >
          {t('accounting.financeSettings.addCategory')}
        </button>
      </div>
      <p className='section-label'>
        {t('accounting.financeSettings.categoryActivityHint')}
      </p>
      <div className='finance-currency-activity-list'>
        {rows.map((category) => {
          const label = getFinanceCategoryLabel(category.slug, t, categories);
          const isAlwaysActive = isAlwaysActiveFinanceCategory(category);
          const canDelete = !category.isSystem;
          const deleteTitle = category.isSystem
            ? t('accounting.financeSettings.cannotDeleteSystemCategory')
            : t('accounting.financeSettings.deleteCategoryTitle');
          const alwaysActiveTitle =
            category.slug === OTHER_CATEGORY_SLUG
              ? t('accounting.financeSettings.otherAlwaysActive')
              : t('accounting.financeSettings.autoAlwaysActive');
          const renameLockedTitle =
            category.slug === OTHER_CATEGORY_SLUG
              ? t('accounting.financeSettings.cannotRenameOtherCategory')
              : t('accounting.financeSettings.cannotRenameAutoCategory');

          return (
            <div
              key={category.slug}
              className={
                isAlwaysActive || category.isActive
                  ? 'finance-currency-activity-item'
                  : 'finance-currency-activity-item finance-category-row-inactive'
              }
            >
              <label className='field-inline finance-currency-activity-toggle finance-category-activity-toggle'>
                <input
                  type='checkbox'
                  checked={isAlwaysActive || category.isActive}
                  disabled={isAlwaysActive}
                  title={isAlwaysActive ? alwaysActiveTitle : undefined}
                  onChange={() => onToggleCategoryActive(category)}
                />
              </label>
              <CategoryNameInput
                category={category}
                isSaving={isSaving}
                label={label}
                renameLocked={isAlwaysActive}
                renameLockedTitle={isAlwaysActive ? renameLockedTitle : undefined}
                onRename={(name) => {
                  const storedName = toFinanceCategoryStoredName(
                    category.slug,
                    name,
                    t,
                  );
                  if (storedName === category.name) return;
                  onRenameCategory(category, storedName);
                }}
              />
              <span
                className={
                  isAlwaysActive || category.isActive
                    ? 'finance-currency-activity-badge'
                    : 'finance-currency-activity-badge finance-currency-activity-badge-off'
                }
              >
                {isAlwaysActive
                  ? t('accounting.financeSettings.alwaysActive')
                  : category.isActive
                    ? t('accounting.financeSettings.active')
                    : t('accounting.financeSettings.inactive')}
              </span>
              <button
                type='button'
                className='orders-filter-delete-button finance-currency-remove-button'
                disabled={!canDelete || isSaving}
                title={deleteTitle}
                onClick={() => onDeleteCategory(category.slug)}
              >
                {t('accounting.financeSettings.deleteCategory')}
              </button>
            </div>
          );
        })}
      </div>
      <CreateFinanceCategoryModal
        isOpen={isCreateOpen}
        isSaving={isSaving}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={async (name) => {
          await onCreateCategory(name);
          setIsCreateOpen(false);
        }}
      />
    </div>
  );
};

export interface CategoryNameInputProps {
  category: FinanceCategory;
  isSaving: boolean;
  label: string;
  renameLocked?: boolean;
  renameLockedTitle?: string;
  onRename: (name: string) => void;
};

const CategoryNameInput = ({
  category,
  isSaving,
  label,
  renameLocked = false,
  renameLockedTitle,
  onRename,
}: CategoryNameInputProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(label);
  const trimmed = draft.trim();
  const isDirty = !renameLocked && trimmed.length > 0 && trimmed !== label;
  const canSave = !renameLocked && trimmed.length >= 2 && !isSaving;

  useEffect(() => {
    setDraft(label);
  }, [label]);

  const commit = () => {
    if (renameLocked) return;
    if (!trimmed) {
      setDraft(label);
      return;
    }
    if (trimmed === label || !canSave) return;
    onRename(trimmed);
  };

  return (
    <div className='finance-category-name-field'>
      <input
        className='finance-category-name-input'
        value={draft}
        maxLength={80}
        autoComplete='off'
        disabled={renameLocked}
        title={renameLocked ? renameLockedTitle : undefined}
        aria-label={t('accounting.financeSettings.categoryName')}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            setDraft(label);
            event.currentTarget.blur();
          }
        }}
        data-category-slug={category.slug}
      />
      {isDirty ? (
        <button
          type='button'
          className='primary-button finance-category-name-save'
          disabled={!canSave}
          onMouseDown={(event) => event.preventDefault()}
          onClick={commit}
        >
          {t('common.save')}
        </button>
      ) : null}
    </div>
  );
};
