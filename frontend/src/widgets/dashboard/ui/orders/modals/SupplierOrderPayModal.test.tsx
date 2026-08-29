import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cashbox } from '../../../../../entities/finance/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import { SupplierOrderPayModal } from './SupplierOrderPayModal';

const cashbox = (patch: Partial<Cashbox> = {}): Cashbox => ({
  id: 'cashbox-1',
  name: 'Main',
  balances: { UAH: 5000 },
  enabledCurrencies: { UAH: true },
  isDefault: true,
  isArchived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const order = (patch: Partial<SupplierOrder> = {}): SupplierOrder => ({
  id: 'supplier-order-1',
  orderBaseId: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Cable Supplier',
  deliveryDate: '2026-01-01',
  supplyType: 'standard',
  number: 'SO000010',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 1550,
  paid: 0,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'USB Cable',
      quantity: 1,
      price: 1550,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('SupplierOrderPayModal', () => {
  it('pays the selected cashbox and hides issue without payment without permission', () => {
    const onPay = vi.fn();
    render(
      <SupplierOrderPayModal
        order={order()}
        cashboxes={[
          cashbox({ id: 'cashbox-2', name: 'Safe', isDefault: false }),
          cashbox(),
        ]}
        isLoading={false}
        isSaving={false}
        canIssueWithoutPayment={false}
        onClose={vi.fn()}
        onPay={onPay}
        onIssueWithoutPayment={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Pay supplier order' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cable Supplier')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Issue without payment' }),
    ).toBeNull();

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'cashbox-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }));
    expect(onPay).toHaveBeenCalledWith('cashbox-2');
  });

  it('disables pay while cashboxes are loading', () => {
    render(
      <SupplierOrderPayModal
        order={order()}
        cashboxes={[]}
        isLoading
        isSaving={false}
        canIssueWithoutPayment={false}
        onClose={vi.fn()}
        onPay={vi.fn()}
        onIssueWithoutPayment={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Pay' })).toBeDisabled();
  });

  it('confirms issue without payment before submitting', () => {
    const onIssueWithoutPayment = vi.fn();
    render(
      <SupplierOrderPayModal
        order={order()}
        cashboxes={[cashbox()]}
        isLoading={false}
        isSaving={false}
        canIssueWithoutPayment
        onClose={vi.fn()}
        onPay={vi.fn()}
        onIssueWithoutPayment={onIssueWithoutPayment}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Issue without payment' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Confirm issue without payment' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.getByRole('heading', { name: 'Pay supplier order' }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Issue without payment' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onIssueWithoutPayment).toHaveBeenCalledTimes(1);
  });
});
