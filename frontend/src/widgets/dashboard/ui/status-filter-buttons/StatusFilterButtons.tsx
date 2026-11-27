import type React from 'react';
import { isAllStatusesSelected } from '../../model/status-selection';

export interface StatusFilterButtonItem<T extends string = string> {
  key: T;
  label: string;
}

export interface StatusFilterButtonsProps<T extends string = string> {
  selectedStatuses: readonly T[];
  options: readonly StatusFilterButtonItem<T>[];
  allLabel: string;
  onToggleStatus: (status: T) => void;
  onToggleAll: () => void;
  className?: string;
}

export const StatusFilterButtons = <T extends string>({
  selectedStatuses,
  options,
  allLabel,
  onToggleStatus,
  onToggleAll,
  className,
}: StatusFilterButtonsProps<T>): React.ReactElement => {
  const allOptionKeys = options.map((opt) => opt.key);
  const isAll = isAllStatusesSelected(selectedStatuses, allOptionKeys);

  return (
    <div
      className={
        className
          ? `warehouse-status-chips ${className}`
          : 'warehouse-status-chips'
      }
      role='group'
    >
      <button
        type='button'
        aria-pressed={isAll}
        className={
          isAll
            ? 'warehouse-mode-button warehouse-mode-button-active'
            : 'warehouse-mode-button'
        }
        onClick={onToggleAll}
      >
        {allLabel}
      </button>
      {options.map((option) => {
        const isPressed = selectedStatuses.includes(option.key);
        return (
          <button
            key={option.key}
            type='button'
            aria-pressed={isPressed}
            className={
              isPressed
                ? 'warehouse-mode-button warehouse-mode-button-active'
                : 'warehouse-mode-button'
            }
            onClick={() => onToggleStatus(option.key)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
