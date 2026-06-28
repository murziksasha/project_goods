import { useTranslation } from 'react-i18next';
import type { WarehouseItem } from '../../../../entities/warehouse-settings/model/types';
import { getActiveWarehouseOptions } from '../../model/warehouse-serial-filter';

type WarehouseSelectFieldProps = {
  warehouses: WarehouseItem[];
  value: string;
  onChange: (warehouseId: string) => void;
  disabled?: boolean;
  className?: string;
  labelKey?: string;
};

export const WarehouseSelectField = ({
  warehouses,
  value,
  onChange,
  disabled = false,
  className,
  labelKey = 'orders.rapidSale.warehouse',
}: WarehouseSelectFieldProps) => {
  const { t } = useTranslation();
  const options = getActiveWarehouseOptions(warehouses);

  return (
    <label className={className ? `field ${className}` : 'field warehouse-serial-picker-field'}>
      <span>{t(labelKey)}</span>
      <div className="warehouse-serial-picker-select-wrap">
        <select
          className="warehouse-serial-picker-select"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || options.length === 0}
          aria-label={t(labelKey)}
        >
          {options.length === 0 ? (
            <option value="">{t('orders.rapidSale.noWarehouses')}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
};