import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../../../shared/api/queryClient';
import type { Employee } from '../../../../../entities/employee/model/types';
import type { Product } from '../../../../../entities/product/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { Client, ClientHistory } from '../../../../../entities/client/model/types';
import type { ClientDevice } from '../../../../../entities/client-device/model/types';
import { CreateOrderCard } from './CreateOrderCard';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';

const {
  createClientMock,
  getClientsMock,
  getClientHistoryMock,
  getClientDevicesMock,
  updateClientDeviceMock,
  deleteClientDeviceMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getClientsMock: vi.fn(async (): Promise<Client[]> => []),
  getClientHistoryMock: vi.fn(async (): Promise<ClientHistory> => ({
    client: {
      id: 'client-1',
      name: 'Client',
      phone: '+380000000000',
      phones: ['+380000000000'],
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    sales: [],
    stats: { totalSales: 0, totalRevenue: 0, totalItemsSold: 0 },
  })),
  getClientDevicesMock: vi.fn(async (): Promise<ClientDevice[]> => []),
  updateClientDeviceMock: vi.fn(async () => ({})),
  deleteClientDeviceMock: vi.fn(async () => ({ id: 'device-1' })),
}));

vi.mock('../../../../../entities/client/api/clientApi', () => ({
  createClient: createClientMock,
  getClients: getClientsMock,
  getClientHistory: getClientHistoryMock,
}));

vi.mock('../../../../../entities/client-device/api/clientDeviceApi', () => ({
  createClientDevice: vi.fn(),
  getClientDevices: getClientDevicesMock,
  updateClientDevice: updateClientDeviceMock,
  deleteClientDevice: deleteClientDeviceMock,
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

const clientDevice = (
  patch: Partial<ClientDevice> = {},
): ClientDevice => ({
  id: 'device-1',
  clientId: 'client-1',
  clientName: 'Client',
  clientPhone: '+380000000000',
  name: 'Кавомашина Delonghi',
  serialNumber: '',
  note: '',
  source: 'repairOrder',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

const emptyClientHistory = (client: Client): ClientHistory => ({
  client,
  sales: [],
  stats: { totalSales: 0, totalRevenue: 0, totalItemsSold: 0 },
});

const lookupClient = (patch: {
  id: string;
  name: string;
  phone: string;
  status?: 'new' | 'vip' | 'opt' | 'blacklist' | 'ok' | '';
}): Client => ({
  email: '',
  address: '',
  registrationId: '',
  iban: '',
  note: '',
  status: 'new' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  phones: [patch.phone],
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

const renderCreateOrderCard = (
  initialTab: 'repair' | 'sale',
  onSave = vi.fn(async () => null),
  onOpenClientCard = vi.fn(),
  clients: Parameters<typeof CreateOrderCard>[0]['clients'] = [],
) =>
  render(
    <CreateOrderCard
      isSaving={false}
      employees={[ownerEmployee]}
      currentEmployee={ownerEmployee}
      initialTab={initialTab}
      catalogProducts={[]}
      products={[product({})]}
      sales={[]}
      clients={clients}
      onClose={vi.fn()}
      onSave={onSave}
      onError={vi.fn()}
      onOpenClientCard={onOpenClientCard}
    />,
);

describe('CreateOrderCard', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  it('renders registered client devices with unbind in the side panel', () => {
    const onUnbindDevice = vi.fn();
    const registeredDevice = clientDevice({
      id: 'device-side-1',
      name: 'USB-C Charger',
      serialNumber: 'S000001',
    });

    render(
      <CreateOrderSidePanel
        hasSelectedClient
        registeredClientDevices={[registeredDevice]}
        unbindingDeviceId={null}
        activeClientRequests={[]}
        activeClientRequestTab="sales"
        selectedFlags={[]}
        onApplyDevice={vi.fn()}
        onUnbindDevice={onUnbindDevice}
        onClientRequestTabChange={vi.fn()}
      />,
    );

    expect(screen.getByText('USB-C Charger')).toBeInTheDocument();
    expect(screen.getByText('S000001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unbind' }));
    expect(onUnbindDevice).toHaveBeenCalledWith(registeredDevice);
  });

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
        status: 'ok',
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
        hasSelectedClient
        registeredClientDevices={[]}
        unbindingDeviceId={null}
        activeClientRequests={[legacySale]}
        activeClientRequestTab="sales"
        selectedFlags={[]}
        onApplyDevice={vi.fn()}
        onUnbindDevice={vi.fn()}
        onClientRequestTabChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText('USB-C Charger')).toHaveLength(1);
    expect(screen.getByText('S000001')).toBeInTheDocument();
    expect(
      document.querySelector('.create-side-requests-list-scrollable'),
    ).toBeNull();
  });

  it('renders all client requests with scroll when there are four or more', () => {
    const clientRequests: Sale[] = Array.from({ length: 6 }, (_, index) => ({
      id: `sale-${index + 1}`,
      recordNumber: `R00000${index + 1}`,
      saleDate: '2026-01-01T00:00:00.000Z',
      quantity: 1,
      salePrice: 1200,
      kind: 'repair',
      status: 'new',
      paidAmount: 0,
      note: '',
      timeline: [],
      paymentHistory: [],
      lineItems: [
        {
          id: `line-${index + 1}`,
          kind: 'product',
          name: `Device ${index + 1}`,
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
        status: 'ok',
      },
      product: null,
      manager: null,
      master: null,
      issuedBy: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));

    const { container } = render(
      <CreateOrderSidePanel
        hasSelectedClient
        registeredClientDevices={[]}
        unbindingDeviceId={null}
        activeClientRequests={clientRequests}
        activeClientRequestTab="orders"
        selectedFlags={[]}
        onApplyDevice={vi.fn()}
        onUnbindDevice={vi.fn()}
        onClientRequestTabChange={vi.fn()}
      />,
    );

    clientRequests.forEach((sale) => {
      expect(screen.getByText(sale.recordNumber!)).toBeInTheDocument();
    });
    expect(
      container.querySelector('.create-side-requests-list-scrollable'),
    ).not.toBeNull();
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

  it('shows a suggestion when user types an additional phone from loaded clients', async () => {
    vi.useFakeTimers();
    const existingClient = {
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380671112233',
      phones: ['+380671112233', '+380635567090'],
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    getClientsMock.mockResolvedValue([]);

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '063556709' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('button', { name: /Existing Client/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('');
    vi.useRealTimers();
  });

  it('auto-selects an existing client when user types an additional phone', async () => {
    const existingClient = {
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380671112233',
      phones: ['+380671112233', '+380635567090'],
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    getClientsMock.mockResolvedValue([existingClient]);

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Another Name' },
    });
    fireEvent.focus(screen.getByPlaceholderText('Enter device name'));

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith('+380635567090');
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Existing Client');
  });

  it('uses an existing exact phone client instead of creating a duplicate for another name', async () => {
    const existingClient = {
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380635567090',
      phones: ['+380635567090'],
      email: '',
      address: '',
      registrationId: '',
      iban: '',
      note: '',
      status: 'new' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    getClientsMock.mockResolvedValue([existingClient]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Another Name' },
    });
    fireEvent.focus(screen.getByPlaceholderText('Enter device name'));

    await waitFor(() => {
      expect(getClientsMock).toHaveBeenCalledWith('+380635567090');
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Existing Client');
  });

  it('shows a blacklist warning while typing a matching repair client phone', async () => {
    vi.useFakeTimers();
    getClientsMock.mockResolvedValue([
      lookupClient({
        id: 'client-blacklist',
        name: 'Risk Client',
        phone: '+380635567090',
        status: 'blacklist',
      }),
    ]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const warning = screen.getByRole('button', {
      name: /Open blacklist client card: Risk Client/,
    });
    expect(warning).toHaveTextContent(
      'Client is in blacklist',
    );
    expect(warning).toHaveTextContent('Risk Client');
  });

  it('keeps the blacklist warning after selecting a client suggestion', async () => {
    vi.useFakeTimers();
    getClientsMock.mockResolvedValue([
      lookupClient({
        id: 'client-blacklist',
        name: 'Risk Client',
        phone: '+380635567090',
        status: 'blacklist',
      }),
    ]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // auto-apply exact phone sets selected client (clears suggestions); warning should still be present
    expect(screen.getByRole('button', {
      name: /Open blacklist client card: Risk Client/,
    })).toHaveTextContent(
      'Client is in blacklist',
    );
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('Risk Client');
  });

  it('opens the selected blacklist client card from the warning notice', async () => {
    vi.useFakeTimers();
    const onOpenClientCard = vi.fn();
    getClientsMock.mockResolvedValue([
      lookupClient({
        id: 'client-blacklist',
        name: 'Risk Client',
        phone: '+380635567090',
        status: 'blacklist',
      }),
    ]);

    renderCreateOrderCard('repair', vi.fn(async () => null), onOpenClientCard);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Open blacklist client card: Risk Client/,
      }),
    );

    expect(onOpenClientCard).toHaveBeenCalledWith('client-blacklist');
  });

  it('shows a blacklist warning on the sales order tab', async () => {
    vi.useFakeTimers();
    getClientsMock.mockResolvedValue([
      lookupClient({
        id: 'client-blacklist',
        name: 'Risk Client',
        phone: '+380635567090',
        status: 'blacklist',
      }),
    ]);

    renderCreateOrderCard('sale');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(screen.getByRole('button', {
      name: /Open blacklist client card: Risk Client/,
    })).toHaveTextContent(
      'Client is in blacklist',
    );
  });

  it('does not show a blacklist warning for a regular client suggestion', async () => {
    vi.useFakeTimers();
    getClientsMock.mockResolvedValue([
      lookupClient({
        id: 'client-regular',
        name: 'Regular Client',
        phone: '+380635567090',
        status: 'new',
      }),
    ]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(
      screen.queryByRole('button', {
        name: /Open blacklist client card/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('blacklist')).not.toBeInTheDocument();
  });

  it('unbinds a removable client device from the create-order side panel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const existingClient = lookupClient({
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380635567090',
    });
    const removableDevice = clientDevice({
      id: 'device-removable',
      clientId: existingClient.id,
      clientName: existingClient.name,
      clientPhone: existingClient.phone,
      name: 'Coffee machine',
      canRemove: true,
      usageCount: 0,
    });
    getClientsMock.mockResolvedValue([existingClient]);
    getClientHistoryMock.mockResolvedValue(
      emptyClientHistory(existingClient),
    );
    getClientDevicesMock.mockResolvedValue([removableDevice]);
    deleteClientDeviceMock.mockResolvedValue({ id: removableDevice.id });

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Existing Client' },
    });

    await waitFor(() => {
      expect(screen.getByText('Coffee machine')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unbind' }));

    await waitFor(() => {
      expect(deleteClientDeviceMock).toHaveBeenCalledWith('device-removable');
    });
    expect(screen.queryByText('Coffee machine')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('deactivates a used client device from the create-order side panel', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const existingClient = lookupClient({
      id: 'client-existing',
      name: 'Existing Client',
      phone: '+380635567090',
    });
    const usedDevice = clientDevice({
      id: 'device-used',
      clientId: existingClient.id,
      clientName: existingClient.name,
      clientPhone: existingClient.phone,
      name: 'Used laptop',
      canRemove: false,
      usageCount: 2,
    });
    getClientsMock.mockResolvedValue([existingClient]);
    getClientHistoryMock.mockResolvedValue(
      emptyClientHistory(existingClient),
    );
    getClientDevicesMock.mockResolvedValue([usedDevice]);
    updateClientDeviceMock.mockResolvedValue({
      ...usedDevice,
      isActive: false,
    });

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });
    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Existing Client' },
    });

    await waitFor(() => {
      expect(screen.getByText('Used laptop')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Unbind' }));

    await waitFor(() => {
      expect(updateClientDeviceMock).toHaveBeenCalledWith(
        'device-used',
        expect.objectContaining({
          isActive: false,
          name: 'Used laptop',
        }),
      );
    });
    expect(screen.queryByText('Used laptop')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('renders repair device suggestions as a compact selectable list', async () => {
    vi.useFakeTimers();
    getClientDevicesMock.mockResolvedValue([
      clientDevice({
        id: 'coffee-1',
        name: 'Кавомашина Delonghi',
      }),
    ]);

    renderCreateOrderCard('repair');

    fireEvent.change(screen.getByPlaceholderText('Enter device name'), {
      target: { value: 'кавома' },
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    const suggestion = screen.getByRole('button', {
      name: /Кавомашина Delonghi/i,
    });
    expect(suggestion).toHaveClass('create-suggestion-item-compact');
    expect(suggestion.closest('.create-suggestions-compact')).not.toBeNull();

    fireEvent.click(suggestion);

    expect(screen.getByPlaceholderText('Enter device name')).toHaveValue(
      'Кавомашина Delonghi',
    );
  });

  const renderWithQueryClient = (ui: ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(queryKeys.warehouseSettings, {
      warehouses: [
        {
          id: 'wh-main',
          name: 'Main warehouse',
          isActive: true,
          serviceCenterId: 'sc-1',
          receiptAddress: '',
          receiptPhone: '',
          locations: [{ id: 'loc-1', name: 'Shelf A' }],
        },
      ],
    });

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('shows rapid sale button only on sales tab and opens modal', () => {
    const onRapidSale = vi.fn(async () => null);

    renderWithQueryClient(
      <CreateOrderCard
        isSaving={false}
        employees={[ownerEmployee]}
        currentEmployee={ownerEmployee}
        initialTab="repair"
        catalogProducts={[]}
        products={[product({})]}
        sales={[]}
        onClose={vi.fn()}
        onSave={vi.fn(async () => null)}
        onRapidSale={onRapidSale}
        onError={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Rapid sale' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sales order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rapid sale' }));
    expect(screen.getByRole('dialog', { name: 'Rapid sale' })).toBeInTheDocument();
  });
});
