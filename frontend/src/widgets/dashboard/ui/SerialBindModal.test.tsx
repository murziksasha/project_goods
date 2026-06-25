import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import { SerialBindModal } from './SerialBindModal';

const warehouse = (patch: Partial<WarehouseItem> = {}): WarehouseItem => ({
  id: 'wh-main',
  name: 'Main warehouse',
  isActive: true,
  serviceCenterId: 'sc-1',
  receiptAddress: '',
  receiptPhone: '',
  locations: [{ id: 'loc-1', name: 'Shelf A' }],
  ...patch,
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Cable',
  article: 'CBL',
  serialNumber: 'S000001',
  price: 100,
  salePriceOptions: [120],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'wh-main',
  locationId: 'loc-1',
  purchaseDate: '2026-01-01T00:00:00.000Z',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('SerialBindModal', () => {
  afterEach(() => {
    cleanup();
  });

  it('defaults to first warehouse and filters serial list by selection', () => {
    const warehouses = [
      warehouse({ id: 'wh-main', name: 'Main warehouse' }),
      warehouse({ id: 'wh-second', name: 'Second warehouse' }),
    ];
    const availableProducts = [
      product({ id: 'p-main', warehouseId: 'wh-main', serialNumber: 'S000001' }),
      product({ id: 'p-second', warehouseId: 'wh-second', serialNumber: 'S000002' }),
    ];

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 2,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={warehouses}
        availableProducts={availableProducts}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Warehouse')).toHaveValue('wh-main');
    expect(screen.getByRole('button', { name: /\[ \] S000001/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\[ \] S000002/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Warehouse'), {
      target: { value: 'wh-second' },
    });

    expect(screen.getByRole('button', { name: /\[ \] S000002/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\[ \] S000001/i })).not.toBeInTheDocument();
  });

  it('calls onSave with selected serials', () => {
    const onSave = vi.fn();
    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 1,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={[warehouse()]}
        availableProducts={[product({ serialNumber: 'S000001' })]}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={onSave}
        onError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\[ \] S000001/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(['S000001']);
  });
});