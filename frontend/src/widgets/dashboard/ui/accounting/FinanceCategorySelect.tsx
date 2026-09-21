import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FinanceCategory } from '../../../../entities/finance';
import {
  getFinanceCategoryLabel,
  getWithdrawDropdownCategories,
  withFallbackWithdrawCategories,
} from '../../../../entities/finance';

export interface FinanceCategorySelectProps {
  categories: FinanceCategory[];
  value: string;
  canAdd?: boolean;
  disabled?: boolean;
  onChange: (slug: string) => void;
  onAdd: () => void;
};

export const FinanceCategorySelect: React.FC<FinanceCategorySelectProps> = ({
  categories,
  value,
  canAdd = false,
  disabled = false,
  onChange,
  onAdd,
}) => {
  const { t } = useTranslation();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const options = getWithdrawDropdownCategories(
    withFallbackWithdrawCategories(categories),
  );
  const selected = options.find((category) => category.slug === value) ?? options[0];
  const selectedLabel = selected
    ? getFinanceCategoryLabel(selected.slug, t, categories)
    : t('accounting.profit.categories.other');

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  return (
    <div
      className={
        isOpen
          ? 'finance-category-select finance-category-select-open'
          : 'finance-category-select'
      }
      ref={rootRef}
    >
      <button
        type='button'
        className='finance-category-select-trigger'
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        {selectedLabel}
      </button>
      {isOpen ? (
        <div className='finance-category-menu'>
          <ul id={listboxId} role='listbox' className='finance-category-options'>
            {options.map((category) => {
              const label = getFinanceCategoryLabel(category.slug, t, categories);
              const isSelected = category.slug === selected?.slug;
              return (
                <li key={category.slug} role='presentation'>
                  <button
                    type='button'
                    role='option'
                    aria-selected={isSelected}
                    className={
                      isSelected
                        ? 'finance-category-option finance-category-option-active'
                        : 'finance-category-option'
                    }
                    onClick={() => {
                      onChange(category.slug);
                      setIsOpen(false);
                    }}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
          {canAdd ? (
            <>
              <div className='finance-category-menu-separator' />
              <button
                type='button'
                className='finance-category-add'
                onClick={() => {
                  setIsOpen(false);
                  onAdd();
                }}
              >
                {t('accounting.financeSettings.addCategory')}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
