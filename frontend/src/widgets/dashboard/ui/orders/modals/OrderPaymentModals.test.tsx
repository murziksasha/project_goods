import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../../../../entities/sale';
import { defaultPrintForms } from '../../../../../entities/settings';
import { PaymentModal, ReturnSaleModal } from './OrderPaymentModals';

const cashbox = {
  id: 'cashbox-1',
  name: 'Main',
  balances: { UAH: 1000, USD: 0 },
  enabledCurrencies: { UAH: true, USD: false },
  isDefault: true,
  isNonCash: false,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 's000001',
  saleDate: '2026-01-01T00:00:00.000Z',
  quantity: 1,
  salePrice: 100,
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [
    {
      id: 'line-unbound',
      kind: 'product',
      productId: 'product-unbound',
      name: 'Splash cover',
      price: 100,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: [],
    },
  ],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'ok',
  },
  product: {
    id: '',
    article: '',
    name: '',
    serialNumber: '',
  },
  manager: null,
  master: null,
  issuedBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const renderPaymentModal = (
  options: {
    paymentSale?: Sale;
    paymentTargetStatus?: 'issued' | 'paid';
    discount?: { mode: 'percent' | 'amount'; value: number };
    onSubmit?: (action: 'deposit' | 'depositAndIssue' | 'issueWithoutPayment') => void;
    onDiscountChange?: (discount: {
      mode: 'percent' | 'amount';
      value: number;
    }) => void;
    isSaving?: boolean;
    isIssueWithoutPaymentBlocked?: boolean;
  } = {},
) => {
  const onSubmit = options.onSubmit ?? vi.fn();
  const onDiscountChange = options.onDiscountChange ?? vi.fn();
  const paymentSale = options.paymentSale ?? sale();
  render(
    <PaymentModal
      sale={paymentSale}
      paymentTargetStatus={options.paymentTargetStatus ?? 'issued'}
      printForms={defaultPrintForms}
      cashboxes={[cashbox]}
      selectedCashboxId={cashbox.id}
      paymentMethod="cash"
      amount="100"
      paidAmount={0}
      total={100}
      discount={options.discount ?? { mode: 'percent', value: 0 }}
      currentPaymentRemaining={100}
      isRepairTargetStatusBlockedByStock={false}
      isIssueWithoutPaymentBlocked={
        options.isIssueWithoutPaymentBlocked ?? false
      }
      isLoading={false}
      isSaving={options.isSaving ?? false}
      onCashboxChange={vi.fn()}
      onPaymentMethodChange={vi.fn()}
      onAmountChange={vi.fn()}
      onDiscountChange={onDiscountChange}
      onClose={vi.fn()}
      onOpenPrint={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onDiscountChange };
};

describe('PaymentModal unbound serial issue warning', () => {
  it('confirms before Accept and issue when a product has no serial', () => {
    const { onSubmit } = renderPaymentModal();

    fireEvent.click(screen.getByRole('button', { name: 'Accept and issue' }));

    const alert = screen.getByRole('alertdialog', {
      name: 'Serial numbers are not bound',
    });
    expect(within(alert).getByText('Splash cover')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('alertdialog', {
        name: 'Serial numbers are not bound',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept and issue' }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', {
          name: 'Serial numbers are not bound',
        }),
      ).getByRole('button', { name: 'Continue' }),
    );
    expect(onSubmit).toHaveBeenCalledWith('depositAndIssue');
  });

  it('does not warn on Accept to cashbox or Issue without payment', () => {
    const { onSubmit } = renderPaymentModal();

    fireEvent.click(screen.getByRole('button', { name: 'Accept to cashbox' }));
    expect(onSubmit).toHaveBeenCalledWith('deposit');
    expect(
      screen.queryByRole('alertdialog', {
        name: 'Serial numbers are not bound',
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Issue without payment' }),
    );
    expect(onSubmit).toHaveBeenCalledWith('issueWithoutPayment');
  });

  it('issues service-only orders without the warning', () => {
    const { onSubmit } = renderPaymentModal({
      paymentSale: sale({
        kind: 'repair',
        lineItems: [
          {
            id: 'svc-1',
            kind: 'service',
            name: 'Diagnostics',
            price: 100,
            quantity: 1,
            warrantyPeriod: 0,
          },
        ],
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Accept and issue' }));
    expect(onSubmit).toHaveBeenCalledWith('depositAndIssue');
    expect(
      screen.queryByRole('alertdialog', {
        name: 'Serial numbers are not bound',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not warn when the payment target is paid', () => {
    const { onSubmit } = renderPaymentModal({
      paymentTargetStatus: 'paid',
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Accept and mark paid' }),
    );
    expect(onSubmit).toHaveBeenCalledWith('depositAndIssue');
    expect(
      screen.queryByRole('alertdialog', {
        name: 'Serial numbers are not bound',
      }),
    ).not.toBeInTheDocument();
  });
});

describe('PaymentModal discount', () => {
  it('defaults empty discount to percent and toggles mode', () => {
    const { onDiscountChange } = renderPaymentModal({
      discount: { mode: 'amount', value: 0 },
    });

    const toggles = screen.getAllByRole('button', {
      name: 'Toggle discount mode',
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveTextContent('%');

    fireEvent.click(toggles[0]);
    expect(onDiscountChange).toHaveBeenCalledWith({
      mode: 'amount',
      value: 0,
    });
  });

  it('commits typed discount on blur', () => {
    const { onDiscountChange } = renderPaymentModal({
      discount: { mode: 'percent', value: 1 },
    });
    const discountInput = document.querySelector<HTMLInputElement>(
      '.order-payment-discount-control input',
    );

    expect(discountInput).not.toBeNull();
    fireEvent.change(discountInput!, { target: { value: '1,3' } });
    fireEvent.blur(discountInput!);
    expect(onDiscountChange).toHaveBeenCalledWith({
      mode: 'percent',
      value: 1.3,
    });
  });

  it('locks discount while saving', () => {
    renderPaymentModal({ isSaving: true });

    for (const toggle of screen.getAllByRole('button', {
      name: 'Toggle discount mode',
    })) {
      expect(toggle).toBeDisabled();
    }
    expect(
      document.querySelector('.order-payment-discount-control input'),
    ).toBeDisabled();
  });
});

describe('ReturnSaleModal layout and behavior', () => {
  it('renders 2-row layout with return-sale-form and allows cashbox selection', () => {
    const onCashboxChange = vi.fn();
    const onWarehouseChange = vi.fn();
    const onAmountChange = vi.fn();
    const onClose = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ReturnSaleModal
        sale={sale({ recordNumber: 'r000777' })}
        lineItems={[
          {
            id: 'line-1',
            kind: 'product',
            name: 'Tablet 10.1',
            price: 4000,
            quantity: 1,
            warrantyPeriod: 12,
          },
        ]}
        cashboxes={[
          cashbox,
          {
            id: 'cashbox-2',
            name: 'Bank Service',
            balances: { UAH: 5000, USD: 0 },
            enabledCurrencies: { UAH: true, USD: false },
            isDefault: false,
            isNonCash: false,
            isArchived: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
        warehouses={[
          {
            id: 'wh-1',
            name: 'Service center',
            isActive: true,
            serviceCenterId: 'sc-1',
            receiptAddress: '',
            receiptPhone: '',
            locations: [],
          },
          {
            id: 'wh-2',
            name: 'Main warehouse',
            isActive: true,
            serviceCenterId: 'sc-1',
            receiptAddress: '',
            receiptPhone: '',
            locations: [],
          },
        ]}
        selectedCashboxId="cashbox-2"
        amount="4000"
        warehouse="Service center"
        paidAmount={4000}
        isLoading={false}
        isSaving={false}
        onCashboxChange={onCashboxChange}
        onAmountChange={onAmountChange}
        onWarehouseChange={onWarehouseChange}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    // Verify form container has return-sale-form class
    const form = document.querySelector('.payment-modal-form.return-sale-form');
    expect(form).not.toBeNull();

    // Verify warehouse field has return-sale-warehouse-field class
    const warehouseField = document.querySelector('.return-sale-warehouse-field');
    expect(warehouseField).not.toBeNull();

    // Verify cashbox field does NOT have payment-cashbox-field class (stacked layout)
    const oldCashboxField = document.querySelector('.payment-cashbox-field');
    expect(oldCashboxField).toBeNull();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    // Warehouse select dropdown
    const warehouseSelect = selects[0];
    expect(warehouseSelect).toHaveValue('Service center');
    expect(screen.getByRole('option', { name: 'Main warehouse' })).toBeInTheDocument();
    fireEvent.change(warehouseSelect, { target: { value: 'Main warehouse' } });
    expect(onWarehouseChange).toHaveBeenCalledWith('Main warehouse');

    // Cashbox select dropdown
    const cashboxSelect = selects[1];
    expect(cashboxSelect).toHaveValue('cashbox-2');
    expect(screen.getByRole('option', { name: 'Bank Service' })).toBeInTheDocument();

    fireEvent.change(cashboxSelect, { target: { value: 'cashbox-1' } });
    expect(onCashboxChange).toHaveBeenCalledWith('cashbox-1');

    // Refund amount is read-only
    const refundInput = screen.getByDisplayValue('4000');
    expect(refundInput).toHaveAttribute('readonly');

    // Click 'Full amount' button calls onAmountChange with paidAmount
    const fullAmountBtn = screen.getByRole('button', { name: 'Full amount' });
    fireEvent.click(fullAmountBtn);
    expect(onAmountChange).toHaveBeenCalledWith('4000');

    fireEvent.click(
      screen.getByRole('button', { name: 'Return sale' }),
    );
    expect(onSubmit).toHaveBeenCalled();
  });

  it('disables submit button when refund amount is invalid (neither goods-only nor full)', () => {
    render(
      <ReturnSaleModal
        sale={sale({ recordNumber: 'r000777' })}
        lineItems={[
          {
            id: 'line-1',
            kind: 'product',
            name: 'Tablet 10.1',
            price: 4000,
            quantity: 1,
            warrantyPeriod: 12,
          },
        ]}
        cashboxes={[cashbox]}
        selectedCashboxId="cashbox-1"
        amount="3000"
        warehouse="Service center"
        paidAmount={4000}
        isLoading={false}
        isSaving={false}
        onCashboxChange={vi.fn()}
        onAmountChange={vi.fn()}
        onWarehouseChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: 'Return sale' });
    expect(submitBtn).toBeDisabled();
  });

  it('enables submit button with goods-only amount and allows toggling to full amount and back', () => {
    const onAmountChange = vi.fn();
    const onSubmit = vi.fn();

    const mixedLineItems = [
      {
        id: 'line-1',
        kind: 'product' as const,
        name: 'Mi Box S',
        price: 4300,
        quantity: 1,
        warrantyPeriod: 12,
      },
      {
        id: 'line-2',
        kind: 'service' as const,
        name: 'Diagnostics',
        price: 700,
        quantity: 1,
        warrantyPeriod: 0,
      },
    ];

    // 1. Initial state: amount is goods-only (4300)
    const { rerender } = render(
      <ReturnSaleModal
        sale={sale({ recordNumber: 'r000964' })}
        lineItems={mixedLineItems}
        cashboxes={[cashbox]}
        selectedCashboxId="cashbox-1"
        amount="4300"
        warehouse="Service center"
        paidAmount={5000}
        isLoading={false}
        isSaving={false}
        onCashboxChange={vi.fn()}
        onAmountChange={onAmountChange}
        onWarehouseChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    // Submit button is enabled with goods-only amount
    const submitBtn = screen.getByRole('button', { name: 'Return sale' });
    expect(submitBtn).toBeEnabled();

    // Button shows 'Full amount'
    const fullAmountBtn = screen.getByRole('button', { name: 'Full amount' });
    fireEvent.click(fullAmountBtn);
    expect(onAmountChange).toHaveBeenCalledWith('5000');

    // 2. Updated state: amount is full (5000)
    rerender(
      <ReturnSaleModal
        sale={sale({ recordNumber: 'r000964' })}
        lineItems={mixedLineItems}
        cashboxes={[cashbox]}
        selectedCashboxId="cashbox-1"
        amount="5000"
        warehouse="Service center"
        paidAmount={5000}
        isLoading={false}
        isSaving={false}
        onCashboxChange={vi.fn()}
        onAmountChange={onAmountChange}
        onWarehouseChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    // Submit button is still enabled
    expect(screen.getByRole('button', { name: 'Return sale' })).toBeEnabled();

    // Button now shows 'Goods only'
    const goodsOnlyBtn = screen.getByRole('button', { name: 'Goods only' });
    fireEvent.click(goodsOnlyBtn);
    expect(onAmountChange).toHaveBeenCalledWith('4300');
  });
  it('disables submit button when refund amount is arbitrary for an order with services', () => {
    render(
      <ReturnSaleModal
        sale={sale({ recordNumber: 'r000964' })}
        lineItems={[
          {
            id: 'line-1',
            kind: 'product' as const,
            name: 'Mi Box S',
            price: 4300,
            quantity: 1,
            warrantyPeriod: 12,
          },
          {
            id: 'line-2',
            kind: 'service' as const,
            name: 'Diagnostics',
            price: 700,
            quantity: 1,
            warrantyPeriod: 0,
          },
        ]}
        cashboxes={[cashbox]}
        selectedCashboxId="cashbox-1"
        amount="2500"
        warehouse="Service center"
        paidAmount={5000}
        isLoading={false}
        isSaving={false}
        onCashboxChange={vi.fn()}
        onAmountChange={vi.fn()}
        onWarehouseChange={vi.fn()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Return sale' })).toBeDisabled();
  });
});

