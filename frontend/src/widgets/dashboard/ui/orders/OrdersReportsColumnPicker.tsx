import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrdersReportColumnDef } from '../../model/orders-reports-settings';

export interface OrdersReportsColumnPickerProps {
  columns: OrdersReportColumnDef[];
  visibleKeys: string[];
  onChange: (next: string[]) => void;
};

export const OrdersReportsColumnPicker: React.FC<OrdersReportsColumnPickerProps> = ({
  columns,
  visibleKeys,
  onChange,
}) => {
  const { t } = useTranslation();
  const visibleSet = new Set(visibleKeys);
  const ordered = [
    ...visibleKeys.map((key) => columns.find((col) => col.key === key)).filter(Boolean),
    ...columns.filter((col) => !visibleSet.has(col.key)),
  ] as OrdersReportColumnDef[];

  const toggle = (key: string) => {
    if (visibleSet.has(key)) {
      const next = visibleKeys.filter((item) => item !== key);
      if (next.length === 0) return;
      onChange(next);
    } else {
      onChange([...visibleKeys, key]);
    }
  };

  const move = (key: string, delta: number) => {
    const index = visibleKeys.indexOf(key);
    if (index < 0) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= visibleKeys.length) return;
    const next = [...visibleKeys];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item!);
    onChange(next);
  };

  const onDragStart = (event: React.DragEvent<HTMLLIElement>, key: string) => {
    event.dataTransfer.setData('text/plain', key);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (event: React.DragEvent<HTMLLIElement>, targetKey: string) => {
    event.preventDefault();
    const sourceKey = event.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === targetKey) return;
    if (!visibleSet.has(sourceKey) || !visibleSet.has(targetKey)) return;
    const next = visibleKeys.filter((item) => item !== sourceKey);
    const targetIndex = next.indexOf(targetKey);
    next.splice(targetIndex, 0, sourceKey);
    onChange(next);
  };

  return (
    <div
      className="orders-reports-column-picker"
      role="group"
      aria-label={t('orders.reports.columnPickerAria')}
    >
      <div className="orders-reports-column-picker-title">
        {t('orders.reports.columnPicker')}
      </div>
      <ul className="orders-reports-column-list">
        {ordered.map((col) => {
          const checked = visibleSet.has(col.key);
          const visibleIndex = visibleKeys.indexOf(col.key);
          return (
            <li
              key={col.key}
              className="orders-reports-column-row"
              draggable={checked}
              onDragStart={(event) => onDragStart(event, col.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, col.key)}
            >
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(col.key)}
                />
                {t(col.labelKey)}
              </label>
              {checked ? (
                <span className="orders-reports-column-reorder">
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={t('orders.reports.moveUp')}
                    disabled={visibleIndex <= 0}
                    onClick={() => move(col.key, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label={t('orders.reports.moveDown')}
                    disabled={visibleIndex === visibleKeys.length - 1}
                    onClick={() => move(col.key, 1)}
                  >
                    ↓
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
