import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  OrderPaymentDiscountControl,
  type OrderPaymentDiscountValue,
} from './OrderPaymentDiscountControl';

const renderControl = (
  options: {
    mode?: 'percent' | 'amount';
    value?: number;
    disabled?: boolean;
    onDiscountChange?: (discount: OrderPaymentDiscountValue) => void;
  } = {},
) => {
  const onDiscountChange =
    options.onDiscountChange ??
    vi.fn<(discount: OrderPaymentDiscountValue) => void>();
  render(
    <dl>
      <OrderPaymentDiscountControl
        discount={{
          mode: options.mode ?? 'amount',
          value: options.value ?? 0,
        }}
        disabled={options.disabled}
        resetKey="sale-1"
        onDiscountChange={onDiscountChange}
      />
    </dl>,
  );

  return { onDiscountChange };
};

describe('OrderPaymentDiscountControl', () => {
  it('defaults a zero discount to percent even when stored mode is amount', () => {
    renderControl({ mode: 'amount', value: 0 });

    const toggles = screen.getAllByRole('button', {
      name: 'Toggle discount mode',
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveTextContent('%');
    expect(toggles[1]).toHaveTextContent('%');
  });

  it('keeps amount mode after toggling a zero discount', () => {
    const { onDiscountChange } = renderControl({
      mode: 'amount',
      value: 0,
    });

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Toggle discount mode' })[0],
    );

    expect(onDiscountChange).toHaveBeenCalledWith({
      mode: 'amount',
      value: 0,
    });
    const toggles = screen.getAllByRole('button', {
      name: 'Toggle discount mode',
    });
    expect(toggles[0]).toHaveTextContent('₴');
    expect(toggles[1]).toHaveTextContent('₴');
  });

  it('persists a typed value as percent when stored amount is zero', () => {
    const onDiscountChange = vi.fn();
    const { container } = render(
      <dl>
        <OrderPaymentDiscountControl
          discount={{ mode: 'amount', value: 0 }}
          resetKey="sale-1"
          onDiscountChange={onDiscountChange}
        />
      </dl>,
    );
    const discountInput = container.querySelector<HTMLInputElement>(
      '.order-payment-discount-control input',
    );

    fireEvent.change(discountInput!, { target: { value: '10' } });
    fireEvent.blur(discountInput!);
    expect(onDiscountChange).toHaveBeenCalledWith({
      mode: 'percent',
      value: 10,
    });
  });

  it('commits percent decimals from comma input on blur', () => {
    const onDiscountChange = vi.fn();
    const { container } = render(
      <dl>
        <OrderPaymentDiscountControl
          discount={{ mode: 'percent', value: 1 }}
          resetKey="sale-1"
          onDiscountChange={onDiscountChange}
        />
      </dl>,
    );
    const discountInput = container.querySelector<HTMLInputElement>(
      '.order-payment-discount-control input',
    );

    expect(discountInput).not.toBeNull();
    fireEvent.change(discountInput!, { target: { value: '1,' } });
    expect(discountInput).toHaveValue('1,');
    fireEvent.change(discountInput!, { target: { value: '1,3' } });
    expect(onDiscountChange).not.toHaveBeenCalled();
    fireEvent.blur(discountInput!);
    expect(onDiscountChange).toHaveBeenCalledWith({
      mode: 'percent',
      value: 1.3,
    });
  });

  it('disables badge, input, and field toggle when locked', () => {
    const { container } = render(
      <dl>
        <OrderPaymentDiscountControl
          discount={{ mode: 'percent', value: 0 }}
          disabled
          resetKey="sale-1"
          onDiscountChange={vi.fn()}
        />
      </dl>,
    );

    for (const toggle of screen.getAllByRole('button', {
      name: 'Toggle discount mode',
    })) {
      expect(toggle).toBeDisabled();
    }
    expect(
      container.querySelector('.order-payment-discount-control input'),
    ).toBeDisabled();
  });
});
