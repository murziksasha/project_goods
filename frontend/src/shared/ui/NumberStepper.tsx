type NumberStepperProps = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

const getDecimalLength = (value: string) => {
  const normalizedValue = value.replace(',', '.');
  const [, decimals = ''] = normalizedValue.split('.');
  return decimals.length;
};

const formatNumber = (value: number, decimals: number) => {
  const fixedValue = value.toFixed(decimals);

  return fixedValue.includes('.')
    ? fixedValue.replace(/\.?0+$/, '')
    : fixedValue;
};

const clamp = (value: number, min?: number, max?: number) => {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
};

export const NumberStepper = ({
  value,
  onChange,
  min,
  max,
  placeholder,
  disabled = false,
  ariaLabel,
  className,
}: NumberStepperProps) => {
  const updateValue = (direction: 1 | -1) => {
    const normalizedValue = value.replace(',', '.').trim();
    const currentValue = Number(normalizedValue || '0');
    const decimalLength = getDecimalLength(normalizedValue);
    const step = decimalLength > 0 ? 1 / 10 ** decimalLength : 1;
    const nextValue = clamp(
      Math.round((currentValue + direction * step) * 10 ** decimalLength) /
        10 ** decimalLength,
      min,
      max,
    );

    onChange(formatNumber(nextValue, decimalLength));
  };

  return (
    <div className={className ? `number-stepper ${className}` : 'number-stepper'}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <div className="number-stepper-controls" aria-hidden="true">
        <button
          type="button"
          onClick={() => updateValue(1)}
          disabled={disabled || (max !== undefined && Number(value || '0') >= max)}
          tabIndex={-1}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => updateValue(-1)}
          disabled={disabled || (min !== undefined && Number(value || '0') <= min)}
          tabIndex={-1}
        >
          -
        </button>
      </div>
    </div>
  );
};
