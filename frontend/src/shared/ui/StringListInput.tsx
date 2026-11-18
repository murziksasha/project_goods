import type React from 'react';
import { useEffect, useRef, useState } from 'react';

export interface StringListInputProps {
  /** Current rows; empty strings are allowed while the user is typing. */
  items: string[];
  onChange: (items: string[]) => void;
  label?: string;
  placeholder?: string;
  addLabel: string;
  getRemoveLabel: (item: string, index: number) => string;
  disabled?: boolean;
  maxItems?: number;
  maxItemLength?: number;
  className?: string;
}

/**
 * Editable list of short text items: one input per item with a "×" remove
 * button and a "+" button after the last row. Enter in a row adds a new row.
 * The parent normalizes (trim, drop empty) before saving.
 */
export const StringListInput: React.FC<StringListInputProps> = ({
  items,
  onChange,
  label,
  placeholder,
  addLabel,
  getRemoveLabel,
  disabled = false,
  maxItems = 20,
  maxItemLength = 80,
  className,
}) => {
  const rows = items.length > 0 ? items : [''];
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const canAdd = !disabled && rows.length < maxItems && rows[rows.length - 1].trim() !== '';

  useEffect(() => {
    if (focusIndex === null) return;
    inputRefs.current[focusIndex]?.focus();
    setFocusIndex(null);
  }, [focusIndex, rows.length]);

  const updateRow = (index: number, value: string) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? value : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(next);
    setFocusIndex(Math.max(0, Math.min(index, next.length - 1)));
  };

  const addRow = () => {
    if (!canAdd) return;
    onChange([...rows, '']);
    setFocusIndex(rows.length);
  };

  return (
    <div className={['field', 'string-list-input', className].filter(Boolean).join(' ')}>
      {label ? <span>{label}</span> : null}
      <ul className="string-list-input-rows">
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1;
          return (
            <li key={index} className="string-list-input-row">
              <input
                ref={(node) => {
                  inputRefs.current[index] = node;
                }}
                value={row}
                maxLength={maxItemLength}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={label ? `${label} ${index + 1}` : undefined}
                onChange={(event) => updateRow(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addRow();
                }}
              />
              {rows.length > 1 || row.trim() ? (
                <button
                  type="button"
                  className="ghost-button string-list-input-remove"
                  aria-label={getRemoveLabel(row, index)}
                  title={getRemoveLabel(row, index)}
                  disabled={disabled}
                  onClick={() => removeRow(index)}
                >
                  ×
                </button>
              ) : null}
              {isLast ? (
                <button
                  type="button"
                  className="ghost-button string-list-input-add"
                  aria-label={addLabel}
                  title={addLabel}
                  disabled={!canAdd}
                  onClick={addRow}
                >
                  +
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
