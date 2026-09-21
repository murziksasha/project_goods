import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeDecimalInput, parseDecimal } from '../../../../../shared/lib/decimal';
import { MONEY_FIELD_COMMIT_MS } from '../../../../../shared/lib/price-stepper';

const CURRENCY_UAH = '\u20B4';

export type OrderPaymentDiscountValue = {
  mode: 'percent' | 'amount';
  value: number;
};

export interface OrderPaymentDiscountControlProps {
  discount: OrderPaymentDiscountValue;
  disabled?: boolean;
  resetKey?: string;
  onDiscountChange: (discount: OrderPaymentDiscountValue) => void;
};

const initialEditorMode = (discount: OrderPaymentDiscountValue) =>
  discount.value > 0 ? discount.mode : 'percent';

export const OrderPaymentDiscountControl: React.FC<OrderPaymentDiscountControlProps> = ({
  discount,
  disabled = false,
  resetKey,
  onDiscountChange,
}) => {
  const { t } = useTranslation();
  const [discountInput, setDiscountInput] = useState(String(discount.value));
  const [editorMode, setEditorMode] = useState<'percent' | 'amount'>(
    () => initialEditorMode(discount),
  );
  const discountRef = useRef(discount);
  const discountInputRef = useRef(discountInput);
  const editorModeRef = useRef(editorMode);
  const onDiscountChangeRef = useRef(onDiscountChange);
  const disabledRef = useRef(disabled);
  const discountCommitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    discountRef.current = discount;
    discountInputRef.current = discountInput;
    editorModeRef.current = editorMode;
    onDiscountChangeRef.current = onDiscountChange;
    disabledRef.current = disabled;
  }, [discount, discountInput, editorMode, onDiscountChange, disabled]);

  const persistDiscountValue = (
    input: string,
    mode = editorModeRef.current,
  ) => {
    if (disabledRef.current) return;

    const currentDiscount = discountRef.current;
    if (input === '') {
      if (currentDiscount.value !== 0) {
        onDiscountChangeRef.current({
          mode,
          value: 0,
        });
      }
      return;
    }
    const nextValue = parseDecimal(input);
    if (!Number.isFinite(nextValue)) return;
    const rounded = nextValue > 0 ? Math.round(nextValue * 100) / 100 : 0;
    if (rounded === currentDiscount.value) return;
    onDiscountChangeRef.current({
      mode,
      value: rounded,
    });
  };

  const cancelDiscountCommit = () => {
    if (discountCommitTimerRef.current) {
      clearTimeout(discountCommitTimerRef.current);
      discountCommitTimerRef.current = undefined;
    }
  };

  const flushDiscountCommit = (input = discountInputRef.current) => {
    cancelDiscountCommit();
    persistDiscountValue(input);
  };

  useEffect(
    () => () => {
      if (discountCommitTimerRef.current) {
        clearTimeout(discountCommitTimerRef.current);
        persistDiscountValue(discountInputRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setEditorMode(initialEditorMode(discountRef.current));
    setDiscountInput(String(discountRef.current.value));
  }, [resetKey]);

  useEffect(() => {
    if (discount.value > 0) {
      setEditorMode(discount.mode);
    }
  }, [discount.mode, discount.value]);

  useEffect(() => {
    setDiscountInput((current) => {
      const currentValue = parseDecimal(current);
      const roundedCurrentValue = Number.isFinite(currentValue)
        ? Math.round(currentValue * 100) / 100
        : NaN;

      if (current.trim() === '' && discount.value === 0) return current;
      if (roundedCurrentValue === discount.value) return current;

      return String(discount.value);
    });
  }, [discount.mode, discount.value, resetKey]);

  const toggleDiscountMode = () => {
    if (disabled) return;

    cancelDiscountCommit();
    const nextMode = editorMode === 'percent' ? 'amount' : 'percent';
    setEditorMode(nextMode);
    const nextValue = parseDecimal(discountInput);
    onDiscountChange({
      mode: nextMode,
      value:
        Number.isFinite(nextValue) && nextValue > 0
          ? Math.round(nextValue * 100) / 100
          : discount.value,
    });
  };

  const modeLabel = editorMode === 'percent' ? '%' : CURRENCY_UAH;

  return (
    <div>
      <dt>
        <span className='payment-summary-discount-label'>
          {t('orders.payment.discount')}
          <button
            type='button'
            className='payment-summary-discount-badge'
            onClick={toggleDiscountMode}
            aria-label={t('orders.payment.toggleDiscountMode')}
            disabled={disabled}
          >
            {modeLabel}
          </button>
        </span>
      </dt>
      <dd>
        <div className='order-payment-discount-control'>
          <input
            type='text'
            inputMode='decimal'
            value={discountInput}
            onChange={(event) => {
              const nextInput = normalizeDecimalInput(event.target.value);
              setDiscountInput(nextInput);
              cancelDiscountCommit();
              discountCommitTimerRef.current = setTimeout(() => {
                discountCommitTimerRef.current = undefined;
                persistDiscountValue(nextInput);
              }, MONEY_FIELD_COMMIT_MS);
            }}
            onBlur={(event) =>
              flushDiscountCommit(
                normalizeDecimalInput(event.currentTarget.value),
              )
            }
            disabled={disabled}
            aria-label={t('orders.payment.discount')}
          />
          <button
            type='button'
            className='order-payment-discount-mode'
            onClick={toggleDiscountMode}
            aria-label={t('orders.payment.toggleDiscountMode')}
            disabled={disabled}
          >
            {modeLabel}
          </button>
        </div>
      </dd>
    </div>
  );
};
