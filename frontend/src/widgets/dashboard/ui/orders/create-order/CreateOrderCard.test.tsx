import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientApi from '../../../../../entities/client/api/clientApi';
import * as clientDeviceApi from '../../../../../entities/client-device/api/clientDeviceApi';
import * as serviceCatalogApi from '../../../../../entities/service-catalog/api/serviceCatalogApi';
import * as warehouseSettingsApi from '../../../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { queryKeys } from '../../../../../shared/api/queryClient';
import type { Employee } from '../../../../../entities/employee/model/types';
import type { Product } from '../../../../../entities/product/model/types';
import type { Sale } from '../../../../../entities/sale/model/types';
import type { Client, ClientHistory } from '../../../../../entities/client/model/types';
import type {
  ClientDevice,
  ClientDeviceFormValues,
} from '../../../../../entities/client-device/model/types';
import type { ServiceCatalogItem } from '../../../../../entities/service-catalog/model/types';
import { CreateOrderCard } from './CreateOrderCard';
import { CreateOrderSidePanel } from './CreateOrderSidePanel';

const {
  createClientMock,
  deleteClientDeviceMock,
  getClientDevicesMock,
  getClientHistoryMock,
  getClientsMock,
  getServiceCatalogItemsMock,
  getWarehouseSettingsMock,
  updateClientDeviceMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getClientsMock: vi.fn<(query?: string) => Promise<Client[]>>(async () => []),
  getClientHistoryMock: vi.fn<(clientId: string) => Promise<ClientHistory>>(async () => ({
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
  getClientDevicesMock: vi.fn<(query?: string) => Promise<ClientDevice[]>>(async () => []),
  updateClientDeviceMock: vi.fn<
    (deviceId: string, payload: ClientDeviceFormValues) => Promise<ClientDevice>
  >(async (deviceId, payload) => ({
    id: deviceId,
    clientId: payload.clientId,
    clientName: payload.clientName,
    clientPhone: payload.clientPhone,
    name: payload.name,
    serialNumber: payload.serialNumber,
    note: payload.note,
    source: payload.source ?? 'repairOrder',
    isActive: payload.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  deleteClientDeviceMock: vi.fn<(deviceId: string) => Promise<{ id: string }>>(async (deviceId) => ({
    id: deviceId,
  })),
  getServiceCatalogItemsMock: vi.fn<(query?: string) => Promise<ServiceCatalogItem[]>>(
    async () => [],
  ),
  getWarehouseSettingsMock: vi.fn(async () => ({
    id: 'warehouse-settings-test',
    serviceCenters: [],
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
    administrators: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
}));

vi.mock('../../../../../entities/client/api/clientApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/client/api/clientApi')
  >();
  return {
    ...actual,
    createClient: createClientMock,
    getClients: getClientsMock,
    getClientHistory: getClientHistoryMock,
  };
});

vi.mock('../../../../../entities/client-device/api/clientDeviceApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/client-device/api/clientDeviceApi')
  >();
  return {
    ...actual,
    getClientDevices: getClientDevicesMock,
    updateClientDevice: updateClientDeviceMock,
    deleteClientDevice: deleteClientDeviceMock,
  };
});

vi.mock('../../../../../entities/service-catalog/api/serviceCatalogApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/service-catalog/api/serviceCatalogApi')
  >();
  return {
    ...actual,
    getServiceCatalogItems: getServiceCatalogItemsMock,
  };
});

vi.mock('../../../../../entities/warehouse-settings/api/warehouseSettingsApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../../../entities/warehouse-settings/api/warehouseSettingsApi')
  >();
  return {
    ...actual,
    getWarehouseSettings: getWarehouseSettingsMock,
    useWarehouseSettingsQuery: () => ({
      data: {
        id: 'warehouse-settings-test',
        serviceCenters: [],
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
        administrators: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
    }),
    useUpdateWarehouseSettingsMutation: vi.fn(),
  };
});

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
  options: {
    catalogProducts?: Parameters<typeof CreateOrderCard>[0]['catalogProducts'];
    products?: Product[];
  } = {},
) =>
  render(
    <CreateOrderCard
      isSaving={false}
      employees={[ownerEmployee]}
      currentEmployee={ownerEmployee}
      initialTab={initialTab}
      catalogProducts={options.catalogProducts ?? []}
      products={options.products ?? [product({})]}
      sales={[]}
      clients={clients}
      onClose={vi.fn()}
      onSave={onSave}
      onError={vi.fn()}
      onOpenClientCard={onOpenClientCard}
    />,
  );

const DEBOUNCE_MS = 400;

const advanceDebounce = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });
};

const afterDebouncedInput = async (
  action: () => void,
  assertion: () => void,
) => {
  vi.useFakeTimers();
  action();
  await advanceDebounce();
  vi.useRealTimers();
  await waitFor(assertion, { timeout: 3000 });
};

const renderWithQueryClient = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.warehouseSettings, warehouseSettingsFixture);

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const warehouseSettingsFixture = {
  id: 'warehouse-settings-test',
  serviceCenters: [],
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
  administrators: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const defaultClientHistory = emptyClientHistory({
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
});

const restoreApiMocks = () => {
  getClientsMock.mockImplementation(async () => []);
  getClientHistoryMock.mockImplementation(async () => defaultClientHistory);
  getClientDevicesMock.mockImplementation(async () => []);
  getServiceCatalogItemsMock.mockImplementation(async () => []);
  getWarehouseSettingsMock.mockImplementation(async () => warehouseSettingsFixture);
  deleteClientDeviceMock.mockImplementation(async (deviceId) => ({ id: deviceId }));
  updateClientDeviceMock.mockImplementation(async (deviceId, payload) => ({
    id: deviceId,
    clientId: payload.clientId,
    clientName: payload.clientName,
    clientPhone: payload.clientPhone,
    name: payload.name,
    serialNumber: payload.serialNumber,
    note: payload.note,
    source: payload.source ?? 'repairOrder',
    isActive: payload.isActive ?? true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));

  vi.spyOn(clientApi, 'getClients').mockImplementation((query = '') => getClientsMock(query));
  vi.spyOn(clientApi, 'getClientHistory').mockImplementation((clientId) =>
    getClientHistoryMock(clientId),
  );
  vi.spyOn(clientDeviceApi, 'getClientDevices').mockImplementation((query = '') =>
    getClientDevicesMock(query),
  );
  vi.spyOn(clientDeviceApi, 'updateClientDevice').mockImplementation((deviceId, payload) =>
    updateClientDeviceMock(deviceId, payload),
  );
  vi.spyOn(clientDeviceApi, 'deleteClientDevice').mockImplementation((deviceId) =>
    deleteClientDeviceMock(deviceId),
  );
  vi.spyOn(serviceCatalogApi, 'getServiceCatalogItems').mockImplementation((query = '') =>
    getServiceCatalogItemsMock(query),
  );
  vi.spyOn(warehouseSettingsApi, 'getWarehouseSettings').mockImplementation(async () =>
    warehouseSettingsFixture,
  );
};

describe('CreateOrderCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    getClientsMock.mockReset();
    getClientHistoryMock.mockReset();
    getClientDevicesMock.mockReset();
    getServiceCatalogItemsMock.mockReset();
    getWarehouseSettingsMock.mockReset();
    deleteClientDeviceMock.mockReset();
    updateClientDeviceMock.mockReset();
    restoreApiMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.restoreAllMocks();
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

  it('resolves catalog suggestion to stock by name and prefills retail price', async () => {
    const stockProduct = product({
      id: 'videx-stock',
      name: 'Videx',
      article: 'CAM-100',
      serialNumber: '',
      price: 500,
      salePriceOptions: [1500, 1200],
    });

    renderCreateOrderCard('sale', vi.fn(async () => null), vi.fn(), [], {
      products: [stockProduct],
      catalogProducts: [
        {
          id: 'catalog-videx',
          name: 'Videx',
          note: 'Catalog note',
          isActive: true,
          sourceTags: [],
          lastSeenAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'Videx' },
        }),
      () => {
        expect(
          screen.getByRole('button', { name: /Videx/i }),
        ).toBeInTheDocument();
      },
    );

    fireEvent.click(screen.getByRole('button', { name: /Videx/i }));

    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale' })).toBeInTheDocument();
  });

  it('keeps catalog-only selection without price when stock is missing', async () => {
    renderCreateOrderCard('sale', vi.fn(async () => null), vi.fn(), [], {
      products: [],
      catalogProducts: [
        {
          id: 'catalog-only',
          name: 'Catalog only item',
          note: 'Catalog note',
          isActive: true,
          sourceTags: [],
          lastSeenAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'Catalog only' },
        }),
      () => {
        expect(screen.getByText('Catalog only item')).toBeInTheDocument();
      },
    );

    fireEvent.click(screen.getByText('Catalog only item'));

    const priceInput = screen
      .getByText('Price')
      .closest('label')
      ?.querySelector('input');
    expect(priceInput).toHaveValue('0');
    expect(screen.queryByRole('button', { name: 'Retail' })).not.toBeInTheDocument();
  });

  it('prefills retail price and product binding for bulk stock without serial', async () => {
    const bulkProduct = product({
      id: 'bulk-1',
      name: 'USB-C Cable',
      article: 'USB-C-01',
      serialNumber: '',
      price: 500,
      salePriceOptions: [1500, 800],
    });

    renderCreateOrderCard('sale', vi.fn(async () => null), vi.fn(), [], {
      products: [bulkProduct],
    });

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'USB-C' },
        }),
      () => {
        expect(screen.getByText('USB-C Cable')).toBeInTheDocument();
      },
    );

    fireEvent.click(screen.getByText('USB-C Cable'));

    expect(screen.getByDisplayValue('1500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wholesale' })).toBeInTheDocument();
  });

  it('falls back to purchase price when retail sale price is missing', async () => {
    const bulkProduct = product({
      id: 'bulk-2',
      name: 'HDMI Adapter',
      article: 'HDMI-01',
      serialNumber: '',
      price: 750,
      salePriceOptions: [0],
    });

    renderCreateOrderCard('sale', vi.fn(async () => null), vi.fn(), [], {
      products: [bulkProduct],
    });

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'HDMI' },
        }),
      () => {
        expect(screen.getByText('HDMI Adapter')).toBeInTheDocument();
      },
    );

    fireEvent.click(screen.getByText('HDMI Adapter'));

    expect(screen.getByDisplayValue('750')).toBeInTheDocument();
  });

  it('binds a warehouse serial product into the sales order payload', async () => {
    const onSave = vi.fn(async () => null);

    renderCreateOrderCard('sale', onSave);

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'S000003' },
        }),
      () => {
        expect(screen.getByText('iPhone 14')).toBeInTheDocument();
      },
    );

    fireEvent.click(screen.getByText('iPhone 14'));

    expect(screen.queryByRole('button', { name: 'iPhone 14' })).toBeNull();

    const quantityInput = screen
      .getByText('Qty')
      .closest('label')
      ?.querySelector('input');
    expect(quantityInput).toBeDisabled();
    expect(quantityInput).toHaveValue('1');

    fireEvent.click(screen.getByText('Save order'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
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

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('+380'), {
          target: { value: '063556709' },
        }),
      () => {
        expect(screen.getByRole('button', { name: /Existing Client/i })).toBeInTheDocument();
      },
    );
    expect(screen.getByPlaceholderText('Full name')).toHaveValue('');
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
      expect(screen.getByPlaceholderText('Full name')).toHaveValue('Existing Client');
    });
    expect(createClientMock).not.toHaveBeenCalled();
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
    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    fireEvent.change(screen.getByPlaceholderText('Full name'), {
      target: { value: 'Another Name' },
    });
    fireEvent.focus(screen.getByPlaceholderText('Enter device name'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Full name')).toHaveValue('Existing Client');
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('shows a blacklist warning while typing a matching repair client phone', async () => {
    const blacklistClient = lookupClient({
      id: 'client-blacklist',
      name: 'Risk Client',
      phone: '+380635567090',
      status: 'blacklist',
    });
    getClientsMock.mockResolvedValue([blacklistClient]);

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [blacklistClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Open blacklist client card: Risk Client/,
        }),
      ).toHaveTextContent('Client is in blacklist');
    });
  });

  it('keeps the blacklist warning after selecting a client suggestion', async () => {
    const blacklistClient = lookupClient({
      id: 'client-blacklist',
      name: 'Risk Client',
      phone: '+380635567090',
      status: 'blacklist',
    });
    getClientsMock.mockResolvedValue([blacklistClient]);

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [blacklistClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Full name')).toHaveValue('Risk Client');
    });

    // auto-apply exact phone sets selected client (clears suggestions); warning should still be present
    expect(screen.getByRole('button', {
      name: /Open blacklist client card: Risk Client/,
    })).toHaveTextContent(
      'Client is in blacklist',
    );
  });

  it('opens the selected blacklist client card from the warning notice', async () => {
    const onOpenClientCard = vi.fn();
    const blacklistClient = lookupClient({
      id: 'client-blacklist',
      name: 'Risk Client',
      phone: '+380635567090',
      status: 'blacklist',
    });
    getClientsMock.mockResolvedValue([blacklistClient]);

    renderCreateOrderCard('repair', vi.fn(async () => null), onOpenClientCard, [
      blacklistClient,
    ]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: /Open blacklist client card: Risk Client/,
        }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: /Open blacklist client card: Risk Client/,
      }),
    );

    expect(onOpenClientCard).toHaveBeenCalledWith('client-blacklist');
  });

  it('shows a blacklist warning on the sales order tab', async () => {
    const blacklistClient = lookupClient({
      id: 'client-blacklist',
      name: 'Risk Client',
      phone: '+380635567090',
      status: 'blacklist',
    });
    getClientsMock.mockResolvedValue([blacklistClient]);

    renderCreateOrderCard('sale', vi.fn(), vi.fn(), [blacklistClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', {
        name: /Open blacklist client card: Risk Client/,
      })).toHaveTextContent(
        'Client is in blacklist',
      );
    });
  });

  it('does not show a blacklist warning for a regular client suggestion', async () => {
    const regularClient = lookupClient({
      id: 'client-regular',
      name: 'Regular Client',
      phone: '+380635567090',
      status: 'new',
    });
    getClientsMock.mockResolvedValue([regularClient]);

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [regularClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Full name')).toHaveValue('Regular Client');
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
    getClientHistoryMock.mockImplementation(async () =>
      emptyClientHistory(existingClient),
    );
    getClientDevicesMock.mockImplementation(async () => [removableDevice]);
    deleteClientDeviceMock.mockImplementation(async () => ({ id: removableDevice.id }));

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(screen.getByText('Coffee machine')).toBeInTheDocument();
    }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: 'Unbind' }));

    await waitFor(() => {
      expect(deleteClientDeviceMock).toHaveBeenCalledWith('device-removable');
    }, { timeout: 3000 });
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
    getClientHistoryMock.mockImplementation(async () =>
      emptyClientHistory(existingClient),
    );
    getClientDevicesMock.mockImplementation(async () => [usedDevice]);
    updateClientDeviceMock.mockImplementation(async () => ({
      ...usedDevice,
      isActive: false,
    }));

    renderCreateOrderCard('repair', vi.fn(), vi.fn(), [existingClient]);

    fireEvent.change(screen.getByPlaceholderText('+380'), {
      target: { value: '0635567090' },
    });

    await waitFor(() => {
      expect(screen.getByText('Used laptop')).toBeInTheDocument();
    }, { timeout: 3000 });

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
    getClientDevicesMock.mockImplementation(async () => [
      clientDevice({
        id: 'coffee-1',
        name: 'Кавомашина Delonghi',
      }),
    ]);

    renderCreateOrderCard('repair');

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Enter device name'), {
          target: { value: 'кавома' },
        }),
      () => {
        expect(getClientDevicesMock).toHaveBeenCalled();
        expect(
          screen.getByRole('button', {
            name: /Кавомашина Delonghi/i,
          }),
        ).toBeInTheDocument();
      },
    );

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

  it('keeps services section collapsed by default on sales tab', () => {
    renderCreateOrderCard('sale');

    expect(screen.getByRole('button', { name: /Services/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(
      screen.queryByRole('button', { name: 'Add service' }),
    ).not.toBeInTheDocument();
  });

  it('shows catalog suggestions when searching by product name', async () => {
    renderCreateOrderCard('sale', vi.fn(async () => null), vi.fn(), [], {
      catalogProducts: [
        {
          id: 'catalog-1',
          name: 'iPhone 14',
          note: 'Catalog note',
          isActive: true,
          sourceTags: [],
          lastSeenAt: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    await afterDebouncedInput(
      () =>
        fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
          target: { value: 'iPhone' },
        }),
      () => {
        expect(
          screen.getByRole('button', { name: /iPhone 14/i }),
        ).toBeInTheDocument();
        expect(screen.getByText(/Catalog note/)).toBeInTheDocument();
      },
    );
  });

  it('adds multiple services to the save payload', async () => {
    const onSave = vi.fn(async () => null);
    getServiceCatalogItemsMock.mockImplementation(async (query = '') => {
      if (query.toLowerCase().includes('clean')) {
        return [
          {
            id: 'service-1',
            name: 'Screen cleaning',
            price: 150,
            salePriceOptions: [150],
            note: '',
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      if (query.toLowerCase().includes('diag')) {
        return [
          {
            id: 'service-2',
            name: 'Diagnostics',
            price: 300,
            salePriceOptions: [300],
            note: '',
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ];
      }
      return [];
    });

    renderCreateOrderCard('sale', onSave);

    fireEvent.click(screen.getByRole('button', { name: /Services/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add service')).toBeInTheDocument();
    });

    vi.useFakeTimers();
    fireEvent.change(screen.getByPlaceholderText('Add service'), {
      target: { value: 'Screen cleaning' },
    });
    await advanceDebounce();
    vi.useRealTimers();
    await waitFor(() => {
      expect(getServiceCatalogItemsMock).toHaveBeenCalled();
      expect(screen.getByText('Screen cleaning')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Screen cleaning'));
    fireEvent.click(document.querySelector('.create-order-add-service-button')!);

    vi.useFakeTimers();
    fireEvent.change(screen.getByPlaceholderText('Add service'), {
      target: { value: 'Diagnostics' },
    });
    await advanceDebounce();
    vi.useRealTimers();
    await waitFor(() => {
      expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Diagnostics'));
    fireEvent.click(document.querySelector('.create-order-add-service-button')!);

    fireEvent.change(screen.getByPlaceholderText('Name, serial or article'), {
      target: { value: 'Manual product line' },
    });
    const priceInputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(priceInputs[0]!, {
      target: { value: '1200' },
    });

    fireEvent.click(screen.getByText('Save order'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        saleServiceItems: [
          expect.objectContaining({
            serviceId: 'service-1',
            name: 'Screen cleaning',
            price: '150',
          }),
          expect.objectContaining({
            serviceId: 'service-2',
            name: 'Diagnostics',
            price: '300',
          }),
        ],
      }),
    );
  });

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
