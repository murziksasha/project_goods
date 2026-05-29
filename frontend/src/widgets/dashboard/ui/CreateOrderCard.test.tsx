import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import { CreateOrderCard } from './CreateOrderCard';

vi.mock('../../../entities/client/api/clientApi', () => ({
  createClient: vi.fn(),
  getClients: vi.fn(async () => []),
  getClientHistory: vi.fn(async () => ({ sales: [] })),
}));

vi.mock('../../../entities/client-device/api/clientDeviceApi', () => ({
  createClientDevice: vi.fn(),
  getClientDevices: vi.fn(async () => []),
}));

vi.mock('../../../entities/warehouse-settings/api/warehouseSettingsApi', () => ({
  getWarehouseSettings: vi.fn(async () => ({ warehouses: [] })),
}));

const product = (patch: Partial<Product>): Product => ({
  id: 'p1',
  name: 'iPhone 14',
  article: 'IPH-14',
  serialNumber: 'S000003',
  price: 1000,
  salePriceOptions: [1200],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: '',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 12,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('CreateOrderCard', () => {
  it('binds a warehouse serial product into the sales order payload', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => true);

    render(
      <CreateOrderCard
        isSaving={false}
        employees={[
          {
            id: 'employee-1',
            name: 'Owner',
            phone: '+380000000000',
            email: 'owner@example.com',
            username: 'owner',
            role: 'owner',
            permissions: ['orders.manage'],
            isActive: true,
            isRegistered: true,
            note: '',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
        currentEmployee={{
          id: 'employee-1',
          name: 'Owner',
          phone: '+380000000000',
          email: 'owner@example.com',
          username: 'owner',
          role: 'owner',
          permissions: ['orders.manage'],
          isActive: true,
          isRegistered: true,
          note: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        initialTab="sale"
        catalogProducts={[]}
        products={[product({})]}
        sales={[]}
        onClose={vi.fn()}
        onSave={onSave}
        onUpdateProductModel={vi.fn(async () => true)}
        onError={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
      target: { value: 'S000003' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByText('iPhone 14'));

    const quantityInput = screen
      .getByText('Qty')
      .closest('label')
      ?.querySelector('input');
    expect(quantityInput).toBeDisabled();
    expect(quantityInput).toHaveValue('1');

    fireEvent.click(screen.getByText('Save order'));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTab: 'sale',
        managerId: 'employee-1',
        saleItems: [
          expect.objectContaining({
            productId: 'p1',
            name: 'iPhone 14',
            serialNumber: 'S000003',
            serialNumbers: ['S000003'],
            quantity: '1',
            price: '1200',
            warrantyPeriod: '12',
          }),
        ],
      }),
    );

    vi.useRealTimers();
  });
});
