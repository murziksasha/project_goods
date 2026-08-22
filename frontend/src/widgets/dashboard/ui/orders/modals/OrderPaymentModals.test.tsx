import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Sale } from '../../../../../entities/sale/model/types';
import { defaultPrintForms } from '../../../../../entities/settings/model/printForms';
import { PaymentModal } from './OrderPaymentModals';

const cashbox = {
  id: 'cashbox-1',
  name: 'Main',
  balances: { UAH: 1000, USD: 0 },
  enabledCurrencies: { UAH: true, USD: false },
  isDefault: true,
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
    onSubmit?: (action: 'deposit' | 'depositAndIssue' | 'issueWithoutPayment') => void;
    isIssueWithoutPaymentBlocked?: boolean;
  } = {},
) => {
  const onSubmit = options.onSubmit ?? vi.fn();
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
      discount={{ mode: 'percent', value: 0 }}
      currentPaymentRemaining={100}
      isRepairTargetStatusBlockedByStock={false}
      isIssueWithoutPaymentBlocked={
        options.isIssueWithoutPaymentBlocked ?? false
      }
      isLoading={false}
      isSaving={false}
      onCashboxChange={vi.fn()}
      onPaymentMethodChange={vi.fn()}
      onAmountChange={vi.fn()}
      onClose={vi.fn()}
      onOpenPrint={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
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
