import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../entities/employee/model/types';
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

const ownerEmployee: Employee = {
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
};

const createLocalStorageMock = () => {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock(),
  configurable: true,
});

const renderCreateOrderCard = (initialTab: 'repair' | 'sale', onSave = vi.fn(async () => true)) =>
  render(
    <CreateOrderCard
      isSaving={false}
      employees={[ownerEmployee]}
      currentEmployee={ownerEmployee}
      initialTab={initialTab}
      catalogProducts={[]}
      products={[product({})]}
      sales={[]}
      onClose={vi.fn()}
      onSave={onSave}
      onError={vi.fn()}
    />,
);

afterEach(() => {
  window.localStorage.clear();
  vi.useRealTimers();
});

describe('CreateOrderCard', () => {
  it('binds a warehouse serial product into the sales order payload', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => true);

    renderCreateOrderCard('sale', onSave);

    fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
      target: { value: 'S000003' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(screen.getByText('iPhone 14'));

    expect(screen.queryByRole('button', { name: 'iPhone 14' })).toBeNull();

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

  it('uses the workspace tab instead of a persisted tab when opening', () => {
    window.localStorage.setItem('project-goods.create-order-tab', 'repair');

    renderCreateOrderCard('sale');

    const tablist = within(
      screen.getAllByRole('tablist', { name: 'Order type tabs' }).at(-1)!,
    );
    expect(
      tablist
        .getAllByRole('button', { name: 'Sales order' })
        .some((button) =>
          button.classList.contains('create-order-tab-active'),
        ),
    ).toBe(true);
    expect(
      tablist
        .getAllByRole('button', { name: 'Repair order' })
        .some((button) =>
          button.classList.contains('create-order-tab-active'),
        ),
    ).toBe(false);
  });

  it('opens on repair when the workspace tab is repair even if sale was persisted', () => {
    window.localStorage.setItem('project-goods.create-order-tab', 'sale');

    renderCreateOrderCard('repair');

    const tablist = within(
      screen.getAllByRole('tablist', { name: 'Order type tabs' }).at(-1)!,
    );
    expect(
      tablist
        .getAllByRole('button', { name: 'Repair order' })
        .some((button) =>
          button.classList.contains('create-order-tab-active'),
        ),
    ).toBe(true);
    expect(
      tablist
        .getAllByRole('button', { name: 'Sales order' })
        .some((button) =>
          button.classList.contains('create-order-tab-active'),
        ),
    ).toBe(false);
  });
});
