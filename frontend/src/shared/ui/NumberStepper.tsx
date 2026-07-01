import {
  normalizeDecimalInput,
  parseDecimal,
} from '../lib/decimal';

type NumberStepperProps = {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  onFocus?: () => void;
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
  step,
  precision,
  placeholder,
  disabled = false,
  ariaLabel,
  className,
  onFocus,
}: NumberStepperProps) => {
  const updateValue = (direction: 1 | -1) => {
    const normalizedValue = normalizeDecimalInput(value);
    const currentValue = parseDecimal(
      normalizedValue.replace(/[,.]$/, '') || '0',
    );
    const decimalLength =
      precision ?? (step !== undefined ? getDecimalLength(String(step)) : getDecimalLength(normalizedValue));
    const stepValue =
      step ?? (decimalLength > 0 ? 1 / 10 ** decimalLength : 1);
    const nextValue = clamp(
      Math.round((currentValue + direction * stepValue) * 10 ** decimalLength) /
        10 ** decimalLength,
      min,
      max,
    );

    onChange(formatNumber(nextValue, decimalLength));
  };
  const parsedValue = parseDecimal(value || '0');

  return (
    <div className={className ? `number-stepper ${className}` : 'number-stepper'}>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(normalizeDecimalInput(event.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onFocus={onFocus}
      />
      <div className="number-stepper-controls" aria-hidden="true">
        <button
          type="button"
          onClick={() => updateValue(1)}
          disabled={disabled || (max !== undefined && Number.isFinite(parsedValue) && parsedValue >= max)}
          tabIndex={-1}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => updateValue(-1)}
          disabled={disabled || (min !== undefined && Number.isFinite(parsedValue) && parsedValue <= min)}
          tabIndex={-1}
        >
          -
        </button>
      </div>
    </div>
  );
};
