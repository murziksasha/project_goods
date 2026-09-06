import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Supplier } from '../../../../entities/supplier/model/types';
import { SupplierModal } from './ProductCatalogModals';

const supplier: Supplier = {
  id: 'supplier-1abc4c51e0',
  name: 'Алексей Пульты Копейка Парусная 7',
  phone: '+380939238080',
  phones: ['+380939238080'],
  supplierOrder: '',
  note: '',
  isActive: true,
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('SupplierModal Add new', () => {
  it('does not clone the same phone and asks for a unique number', () => {
    const onCreate = vi.fn(async () => true);

    render(
      <SupplierModal
        supplier={supplier}
        onClose={vi.fn()}
        onSave={vi.fn(async () => undefined)}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add new' }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('heading', { name: 'Create supplier' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('+380')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(`${supplier.name} (new)`),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('creates a new supplier after the phone is unique', async () => {
    const onCreate = vi.fn(async () => true);
    const onClose = vi.fn();

    render(
      <SupplierModal
        supplier={supplier}
        onClose={onClose}
        onSave={vi.fn(async () => undefined)}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add new' }));
    fireEvent.change(screen.getByDisplayValue('+380'), {
      target: { value: '+380501112233' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        name: `${supplier.name} (new)`,
        phone: '+380501112233',
        note: '',
        isActive: true,
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
