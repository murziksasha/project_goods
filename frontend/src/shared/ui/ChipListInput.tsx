import type React from 'react';

export interface ChipListInputProps {
  /** Items shown as chips. */
  items: readonly string[];
  /** Text of the add input (controlled). */
  inputValue: string;
  onInputChange: (value: string) => void;
  /** "+" click or Enter in the input. The parent splits, dedupes and clears. */
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Accessible name of the list and the input. */
  label: string;
  placeholder?: string;
  addLabel: string;
  getRemoveLabel: (item: string, index: number) => string;
  /** Text when there are no items and the control is read-only. */
  emptyText?: string;
  disabled?: boolean;
  readOnly?: boolean;
  maxItems?: number;
  maxItemLength?: number;
  className?: string;
}

/**
 * Short text items as chips with "×", plus an input with a "+" button at the
 * end (Enter also adds). Markup uses no nested <div>, so it can sit inside
 * grid-styled description lists.
 */
export const ChipListInput: React.FC<ChipListInputProps> = ({
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  label,
  placeholder,
  addLabel,
  getRemoveLabel,
  emptyText,
  disabled = false,
  readOnly = false,
  maxItems = 20,
  maxItemLength = 80,
  className,
}) => {
  const isFull = items.length >= maxItems;
  const canAdd = !disabled && !readOnly && !isFull && inputValue.trim() !== '';

  return (
    <span
      className={['chip-list-input', className].filter(Boolean).join(' ')}
      aria-busy={disabled || undefined}
    >
      {items.length > 0 ? (
        <ul className="chip-list-input-chips" aria-label={label}>
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="chip-list-input-chip">
              <span className="chip-list-input-chip-text">{item}</span>
              {readOnly ? null : (
                <button
                  type="button"
                  className="chip-list-input-chip-remove"
                  aria-label={getRemoveLabel(item, index)}
                  title={getRemoveLabel(item, index)}
                  disabled={disabled}
                  onClick={() => onRemove(index)}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : readOnly && emptyText ? (
        <span className="chip-list-input-empty">{emptyText}</span>
      ) : null}
      {readOnly ? null : (
        <span className="chip-list-input-entry">
          <input
            type="text"
            value={inputValue}
            maxLength={maxItemLength}
            placeholder={placeholder}
            disabled={disabled || isFull}
            aria-label={label}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (canAdd) onAdd();
            }}
          />
          <button
            type="button"
            className="chip-list-input-add"
            aria-label={addLabel}
            title={addLabel}
            disabled={!canAdd}
            onClick={onAdd}
          >
            +
          </button>
        </span>
      )}
    </span>
  );
};
