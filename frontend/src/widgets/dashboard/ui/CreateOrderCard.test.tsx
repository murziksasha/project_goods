import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Employee } from '../../../entities/employee/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { createClient, getClients } from '../../../entities/client/api/clientApi';
import { CreateOrderCard } from './CreateOrderCard';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';

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

const renderCreateOrderCard = (initialTab: 'repair' | 'sale', onSave = vi.fn(async () => null)) =>
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
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('CreateOrderCard', () => {
  it('renders client request history when an existing sale has no product snapshot', () => {
    const legacySale: Sale = {
      id: 'sale-without-product',
      recordNumber: 'S000001',
      saleDate: '2026-01-01T00:00:00.000Z',
      quantity: 1,
      salePrice: 1200,
      kind: 'sale',
      status: 'new',
      paidAmount: 0,
      note: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [
        {
          id: 'line-1',
          kind: 'product',
          name: 'USB-C Charger',
          price: 1200,
          quantity: 1,
          warrantyPeriod: 12,
          serialNumbers: [],
        },
      ],
      client: {
        id: 'client-1',
        name: 'Client',
        phone: '+380000000000',
        status: 'regular',
      },
      product: null,
      manager: null,
      master: null,
      issuedBy: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    render(
      <CreateOrderSidePanel
        deviceHistory={[legacySale]}
        activeClientRequests={[legacySale]}
        activeClientRequestTab="sales"
        selectedFlags={[]}
        onApplyDevice={vi.fn()}
        onClientRequestTabChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('USB-C Charger')).toHaveLength(2);
    expect(screen.getByText('S000001')).toBeInTheDocument();
  });

  it('binds a warehouse serial product into the sales order payload', async () => {
    vi.useFakeTimers();
    const onSave = vi.fn(async () => null);

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

  it('uses an existing exact phone client instead of creating a duplicate for another name', async () => {
    const existingClient = {
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380635567090',
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(getClients).mockResolvedValue([existingClient]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Another Name' },
    });
    fireEvent.focus(screen.getByPlaceholderText('Enter device name'));

    await waitFor(() => {
      expect(getClients).toHaveBeenCalledWith('+380635567090');
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Existing Client');
  });
});
