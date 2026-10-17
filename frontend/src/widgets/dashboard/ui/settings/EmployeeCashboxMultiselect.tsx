import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Cashbox } from '../../../../entities/finance';

export interface EmployeeCashboxMultiselectProps {
  cashboxes: Cashbox[];
  selectedCashboxIds: string[];
  onChange: (cashboxIds: string[]) => void;
  disabled?: boolean;
  isOwner?: boolean;
  canPay?: boolean;
}

export const EmployeeCashboxMultiselect: React.FC<EmployeeCashboxMultiselectProps> = ({
  cashboxes,
  selectedCashboxIds,
  onChange,
  disabled = false,
  isOwner = false,
  canPay = true,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const isInteractionDisabled = disabled || isOwner || !canPay;

  const activeCashboxes = useMemo(
    () => cashboxes.filter((cashbox) => !cashbox.isArchived),
    [cashboxes],
  );

  const filteredCashboxes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeCashboxes;
    return activeCashboxes.filter((cashbox) =>
      cashbox.name.toLowerCase().includes(query),
    );
  }, [activeCashboxes, searchQuery]);

  const selectedCount = selectedCashboxIds.length;
  const isAllSelected =
    activeCashboxes.length > 0 &&
    activeCashboxes.every((cashbox) =>
      selectedCashboxIds.includes(cashbox.id),
    );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (cashboxId: string) => {
    if (isInteractionDisabled) return;
    if (selectedCashboxIds.includes(cashboxId)) {
      onChange(selectedCashboxIds.filter((id) => id !== cashboxId));
    } else {
      onChange([...selectedCashboxIds, cashboxId]);
    }
  };

  const handleSelectAll = () => {
    if (isInteractionDisabled) return;
    onChange(activeCashboxes.map((cashbox) => cashbox.id));
  };

  const handleDeselectAll = () => {
    if (isInteractionDisabled) return;
    onChange([]);
  };

  const triggerLabel =
    selectedCount === 0
      ? t('employees.form.cashboxes.placeholder')
      : t('employees.form.cashboxes.selectedCount', { count: selectedCount });

  return (
    <div
      ref={containerRef}
      className={`employee-cashbox-multiselect ${isInteractionDisabled ? 'is-disabled' : ''} ${isOpen ? 'is-open' : ''}`}
    >
      <label className="field-label" htmlFor="employee-cashboxes-trigger">
        {t('employees.form.cashboxes.label')}
      </label>

      <button
        id="employee-cashboxes-trigger"
        type="button"
        className="employee-cashbox-multiselect-trigger"
        onClick={() => {
          if (!isInteractionDisabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        disabled={isInteractionDisabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="trigger-text">{triggerLabel}</span>
        <span className="trigger-arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOwner ? (
        <p className="employee-cashbox-notice is-info">
          {t('employees.form.cashboxes.ownerNotice')}
        </p>
      ) : !canPay ? (
        <p className="employee-cashbox-notice is-warning">
          {t('employees.form.cashboxes.permissionRequiredNotice')}
        </p>
      ) : null}

      {isOpen && !isInteractionDisabled ? (
        <div className="employee-cashbox-dropdown">
          <div className="employee-cashbox-search-wrapper">
            <input
              type="text"
              className="employee-cashbox-search"
              placeholder={t('employees.form.cashboxes.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="employee-cashbox-actions">
            <button
              type="button"
              className="employee-cashbox-action-btn"
              onClick={handleSelectAll}
              disabled={isAllSelected || activeCashboxes.length === 0}
            >
              {t('employees.form.cashboxes.selectAll')}
            </button>
            <button
              type="button"
              className="employee-cashbox-action-btn"
              onClick={handleDeselectAll}
              disabled={selectedCount === 0}
            >
              {t('employees.form.cashboxes.deselectAll')}
            </button>
          </div>

          <div className="employee-cashbox-list" role="listbox">
            {filteredCashboxes.length === 0 ? (
              <div className="employee-cashbox-empty">
                {t('cashboxes.searchNoResults')}
              </div>
            ) : (
              filteredCashboxes.map((cashbox) => {
                const isChecked = selectedCashboxIds.includes(cashbox.id);
                return (
                  <label
                    key={cashbox.id}
                    className="employee-cashbox-item"
                    role="option"
                    aria-selected={isChecked}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(cashbox.id)}
                    />
                    <span className="employee-cashbox-name">{cashbox.name}</span>
                    <span
                      className={`employee-cashbox-badge ${cashbox.isNonCash ? 'is-non-cash' : 'is-cash'}`}
                    >
                      {cashbox.isNonCash
                        ? t('orders.payment.nonCash')
                        : t('orders.payment.cash')}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
