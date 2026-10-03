import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientDevice } from '../../../../entities/client-device';
import type { CatalogProduct } from '../../../../entities/catalog-product';
import type { Employee } from '../../../../entities/employee';
import type { ServiceCatalogItem } from '../../../../entities/service-catalog';
import type { Supplier } from '../../../../entities/supplier';
import { ProductCatalogPanel } from './ProductCatalogPanel';

vi.mock(
  '../../../../entities/saved-filter',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../entities/saved-filter')
      >();
    return {
      ...actual,
      listSavedFilters: vi.fn(async () => []),
      createSavedFilter: vi.fn(
        async (payload: {
          scope: string;
          tab: string;
          name: string;
          icon: string;
          filters: unknown;
        }) => ({
          id: 'saved-1',
          employeeId: 'employee-1',
          scope: payload.scope,
          tab: payload.tab,
          name: payload.name,
          icon: payload.icon,
          filters: payload.filters,
          createdAt: '2026-06-13T00:00:00.000Z',
        }),
      ),
      deleteSavedFilter: vi.fn(async () => ({
        id: 'saved-1',
        deleted: true,
      })),
    };
  },
);

const employee: Employee = {
  id: 'employee-1',
  name: 'Tester',
  phone: '',
  email: '',
  role: 'owner',
  username: 'tester',
  permissions: [],
  isActive: true,
  isRegistered: true,
  note: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

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

const catalogProduct = (
  patch: Partial<CatalogProduct> = {},
): CatalogProduct => ({
  id: 'catalog-product-1',
  name: 'Display module',
  note: '',
  isActive: true,
  sourceTags: [],
  lastSeenAt: '2026-06-13T00:00:00.000Z',
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

const supplier = (patch: Partial<Supplier> = {}): Supplier => ({
  id: 'supplier-1',
  name: 'Main Parts',
  phone: '+380501111111',
  phones: ['+380501111111'],
  supplierOrder: '',
  note: '',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

const serviceItem = (
  patch: Partial<ServiceCatalogItem> = {},
): ServiceCatalogItem => ({
  id: 'service-1',
  name: 'Ремонт системного блоку',
  price: 500,
  salePriceOptions: [],
  note: 'Board repair',
  isActive: true,
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  ...patch,
});

const typeCatalogSearch = (value: string) => {
  const input = document.querySelector(
    '.catalog-search-group input',
  ) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
};

const renderPanel = ({
  catalogProducts = [],
  clientDevices = [],
  suppliers = [],
  services = [],
  searchQuery = '',
  onServiceCancelEdit = vi.fn<() => void>(),
  onMergeClientDevice = vi.fn(async () => true),
  onMergeCatalogProduct = vi.fn(async () => true),
  onMergeService = vi.fn(async () => true),
  onMergeSupplier = vi.fn(async () => true),
}: {
  catalogProducts?: CatalogProduct[];
  clientDevices?: ClientDevice[];
  suppliers?: Supplier[];
  services?: ServiceCatalogItem[];
  searchQuery?: string;
  onServiceCancelEdit?: () => void;
  onMergeClientDevice?: (
    targetDeviceId: string,
    sourceDeviceId: string,
    draftNote?: string,
  ) => Promise<boolean>;
  onMergeCatalogProduct?: (
    targetCatalogProductId: string,
    sourceCatalogProductId: string,
    draftNote?: string,
  ) => Promise<boolean>;
  onMergeService?: (
    targetServiceId: string,
    sourceServiceId: string,
    draftNote?: string,
  ) => Promise<boolean>;
  onMergeSupplier?: (
    targetSupplierId: string,
    sourceSupplierId: string,
    draftNote?: string,
  ) => Promise<boolean>;
} = {}) =>
  render(
    <ProductCatalogPanel
      currentEmployee={employee}
      products={[]}
      clientDevices={clientDevices}
      catalogProducts={catalogProducts}
      isCatalogProductsLoading={false}
      isLoading={false}
      searchQuery={searchQuery}
      currentSearchValue={searchQuery}
      productForm={{
        article: '',
        name: '',
        serialNumber: '',
        price: '',
        salePriceOptions: '',
        note: '',
        quantity: '',
        purchasePlace: '',
        purchaseDate: '',
        warrantyPeriod: '',
      }}
      isProductSaving={false}
      isProductEditing={false}
      onSearchChange={vi.fn()}
      onProductChange={vi.fn()}
      onProductSubmit={vi.fn()}
      onProductCancelEdit={vi.fn()}
      onArchiveProduct={vi.fn()}
      onActivateProduct={vi.fn()}
      services={services}
      serviceForm={{
        name: '',
        price: '',
        salePriceOptions: '',
        note: '',
        isActive: true,
      }}
      isServicesLoading={false}
      isServiceSaving={false}
      isServiceEditing={false}
      serviceSearchQuery=''
      currentServiceSearchValue=''
      onServiceSearchChange={vi.fn()}
      onServiceChange={vi.fn()}
      onServiceSubmit={vi.fn()}
      onServiceCancelEdit={onServiceCancelEdit}
      onServiceEdit={vi.fn()}
      onServiceArchive={vi.fn()}
      onServiceActivate={vi.fn()}
      suppliers={suppliers}
      onCreateSupplier={vi.fn(async () => true)}
      onUpdateSupplier={vi.fn(async () => true)}
      onCreateClientDevice={vi.fn(async () => true)}
      onUpdateClientDevice={vi.fn(async () => true)}
      onDeleteClientDevice={vi.fn(async () => true)}
      onUpdateCatalogProduct={vi.fn(async () => true)}
      onCreateCatalogProduct={vi.fn(async () => true)}
      onDeleteCatalogProduct={vi.fn(async () => true)}
      onMergeClientDevice={onMergeClientDevice}
      onMergeCatalogProduct={onMergeCatalogProduct}
      onMergeService={onMergeService}
      onMergeSupplier={onMergeSupplier}
    />,
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.clearAllMocks();
});

describe('ProductCatalogPanel client devices search', () => {
  it('filters clients devices only by visible device name', () => {
    renderPanel({
      clientDevices: [
        clientDevice({
          id: 'coffee-1',
          name: 'Кавомашина Delonghi',
        }),
        clientDevice({
          id: 'coffee-2',
          name: 'Кавомашина Saeco incanto Sirius',
        }),
        clientDevice({
          id: 'robot-1',
          name: 'Робот пилосос RoboRock',
          clientName: 'кавома hidden client',
        }),
      ],
    });

    typeCatalogSearch('кавома');

    expect(
      screen.getByText('Кавомашина Delonghi'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Кавомашина Saeco incanto Sirius'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Робот пилосос RoboRock'),
    ).not.toBeInTheDocument();
  });

  it('keeps the no devices state for unmatched device names', () => {
    renderPanel({
      clientDevices: [
        clientDevice({
          id: 'robot-1',
          name: 'Робот пилосос RoboRock',
          clientName: 'кавома hidden client',
        }),
      ],
    });

    typeCatalogSearch('кавома');

    expect(screen.getByText('No devices found.')).toBeInTheDocument();
  });

  it('applies and saves filters only for the active catalog tab', async () => {
    renderPanel({
      clientDevices: [
        clientDevice({
          id: 'active-device',
          name: 'Coffee machine',
          isActive: true,
          createdAt: '2026-06-12T00:00:00.000Z',
        }),
        clientDevice({
          id: 'inactive-device',
          name: 'Robot vacuum',
          isActive: false,
          createdAt: '2026-06-10T00:00:00.000Z',
        }),
      ],
      catalogProducts: [catalogProduct({ name: 'Coffee filter' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Device name'), {
      target: { value: 'Coffee' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Coffee machine')).toBeInTheDocument();
    expect(
      screen.queryByText('Robot vacuum'),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Save filter' }),
    );
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'Active coffee' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('button', { name: /Active coffee/ })
          .some(
            (button) =>
              button.className === 'orders-filter-saved-button',
          ),
      ).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));

    expect(
      screen
        .queryAllByRole('button', { name: /Active coffee/ })
        .some(
          (button) =>
            button.className === 'orders-filter-saved-button',
        ),
    ).toBe(false);
  });

  it('opens and closes the create service form on the services tab', () => {
    const onServiceCancelEdit = vi.fn<() => void>();

    renderPanel({ onServiceCancelEdit });

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Create service' }),
    );

    expect(
      screen.getByRole('heading', { name: 'Add service' }),
    ).toBeInTheDocument();
    onServiceCancelEdit.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(
      screen.queryByRole('heading', { name: 'Add service' }),
    ).not.toBeInTheDocument();
    expect(onServiceCancelEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole('button', { name: 'Create service' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Add service' }),
    ).toBeInTheDocument();
    onServiceCancelEdit.mockClear();

    fireEvent.click(
      screen.getByRole('button', { name: 'Create service' }),
    );

    expect(
      screen.queryByRole('heading', { name: 'Add service' }),
    ).not.toBeInTheDocument();
    expect(onServiceCancelEdit).toHaveBeenCalledTimes(1);
  });

  it('filters suppliers catalog tab by date and status', () => {
    renderPanel({
      suppliers: [
        supplier({
          id: 'supplier-active',
          name: 'Fresh Supplier',
          isActive: true,
          createdAt: '2026-06-14T00:00:00.000Z',
        }),
        supplier({
          id: 'supplier-old',
          name: 'Old Supplier',
          isActive: false,
          createdAt: '2026-05-01T00:00:00.000Z',
        }),
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Suppliers' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText('Date from'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Fresh Supplier')).toBeInTheDocument();
    expect(
      screen.queryByText('Old Supplier'),
    ).not.toBeInTheDocument();
  });

  it('keeps search queries isolated across catalog tabs', () => {
    renderPanel({
      clientDevices: [
        clientDevice({ id: 'device-coffee', name: 'Coffee machine' }),
        clientDevice({ id: 'device-robot', name: 'Robot vacuum' }),
      ],
      catalogProducts: [
        catalogProduct({
          id: 'product-filter',
          name: 'Coffee filter',
        }),
        catalogProduct({ id: 'product-cable', name: 'Power cable' }),
      ],
    });

    typeCatalogSearch('Coffee');
    expect(screen.getByText('Coffee machine')).toBeInTheDocument();
    expect(
      screen.queryByText('Robot vacuum'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    expect(screen.getByText('Coffee filter')).toBeInTheDocument();
    expect(screen.getByText('Power cable')).toBeInTheDocument();
  });

  it('renders useful columns and drops dummy service checkboxes', () => {
    renderPanel({
      clientDevices: [
        clientDevice({ name: 'Coffee machine', note: 'Kitchen' }),
      ],
      catalogProducts: [
        catalogProduct({ name: 'Coffee filter', note: 'Mesh' }),
      ],
      suppliers: [
        supplier({ name: 'Fresh Supplier', note: 'Main parts' }),
      ],
      services: [serviceItem()],
    });

    expect(
      screen.getByRole('columnheader', { name: 'Usage' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Note' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Status' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    expect(
      screen.getByRole('columnheader', { name: 'Last seen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mesh')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    expect(
      screen.getByRole('columnheader', { name: 'Price' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'x' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Board repair')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Suppliers' }),
    );
    expect(
      screen.getByRole('columnheader', { name: 'Phone' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Main parts')).toBeInTheDocument();
  });

  it('renders merge button on all 4 tabs and opens the corresponding merge modal', () => {
    renderPanel({
      clientDevices: [
        clientDevice({ id: 'd-1', name: 'Delonghi Device' }),
        clientDevice({ id: 'd-2', name: 'Saeco Device' }),
      ],
      catalogProducts: [
        catalogProduct({ id: 'cp-1', name: 'Display Module' }),
        catalogProduct({ id: 'cp-2', name: 'Battery 4000mAh' }),
      ],
      services: [
        serviceItem({ id: 's-1', name: 'Screen Replacement' }),
        serviceItem({ id: 's-2', name: 'Diagnostic' }),
      ],
      suppliers: [
        supplier({ id: 'sup-1', name: 'Alpha Supplier' }),
        supplier({ id: 'sup-2', name: 'Beta Supplier' }),
      ],
    });

    // 1. Client devices tab (default)
    const deviceMergeButton = screen.getByRole('button', {
      name: 'Merge',
    });
    expect(deviceMergeButton).toBeInTheDocument();
    fireEvent.click(deviceMergeButton);
    expect(
      screen.getByText('Merge client devices'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Merge client devices'),
    ).not.toBeInTheDocument();

    // 2. Products tab
    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    const productMergeButton = screen.getByRole('button', {
      name: 'Merge',
    });
    expect(productMergeButton).toBeInTheDocument();
    fireEvent.click(productMergeButton);
    expect(screen.getByText('Merge products')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Merge products'),
    ).not.toBeInTheDocument();

    // 3. Services tab
    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    const serviceMergeButton = screen.getByRole('button', {
      name: 'Merge',
    });
    expect(serviceMergeButton).toBeInTheDocument();
    fireEvent.click(serviceMergeButton);
    expect(screen.getByText('Merge services')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Merge services'),
    ).not.toBeInTheDocument();

    // 4. Suppliers tab
    fireEvent.click(
      screen.getByRole('button', { name: 'Suppliers' }),
    );
    const supplierMergeButton = screen.getByRole('button', {
      name: 'Merge',
    });
    expect(supplierMergeButton).toBeInTheDocument();
    fireEvent.click(supplierMergeButton);
    expect(screen.getByText('Merge suppliers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByText('Merge suppliers'),
    ).not.toBeInTheDocument();
  });
});
