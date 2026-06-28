import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientDevice } from '../../../../entities/client-device/model/types';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Employee } from '../../../../entities/employee/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import { ProductCatalogPanel } from './ProductCatalogPanel';

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

const renderPanel = ({
  catalogProducts = [],
  clientDevices = [],
  suppliers = [],
  searchQuery = '',
  onServiceCancelEdit = vi.fn<() => void>(),
}: {
  catalogProducts?: CatalogProduct[];
  clientDevices?: ClientDevice[];
  suppliers?: Supplier[];
  searchQuery?: string;
  onServiceCancelEdit?: () => void;
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
      services={[]}
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
      searchQuery: 'кавома',
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

    expect(screen.getByText('Кавомашина Delonghi')).toBeInTheDocument();
    expect(screen.getByText('Кавомашина Saeco incanto Sirius')).toBeInTheDocument();
    expect(screen.queryByText('Робот пилосос RoboRock')).not.toBeInTheDocument();
  });

  it('keeps the no products state for unmatched device names', () => {
    renderPanel({
      searchQuery: 'кавома',
      clientDevices: [
        clientDevice({
          id: 'robot-1',
          name: 'Робот пилосос RoboRock',
          clientName: 'кавома hidden client',
        }),
      ],
    });

    expect(screen.getByText('No products found.')).toBeInTheDocument();
  });

  it('applies and saves filters only for the active catalog tab', () => {
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
    expect(screen.queryByText('Robot vacuum')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    fireEvent.change(screen.getByPlaceholderText('My filter'), {
      target: { value: 'Active coffee' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen
        .getAllByRole('button', { name: /Active coffee/ })
        .some((button) => button.className === 'orders-filter-saved-button'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Products' }));

    expect(
      screen
        .queryAllByRole('button', { name: /Active coffee/ })
        .some((button) => button.className === 'orders-filter-saved-button'),
    ).toBe(false);
  });

  it('opens and closes the create service form on the services tab', () => {
    const onServiceCancelEdit = vi.fn<() => void>();

    renderPanel({ onServiceCancelEdit });

    fireEvent.click(screen.getByRole('button', { name: 'Services' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create service' }));

    expect(screen.getByRole('heading', { name: 'Add service' })).toBeInTheDocument();
    onServiceCancelEdit.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('heading', { name: 'Add service' })).not.toBeInTheDocument();
    expect(onServiceCancelEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Create service' }));
    expect(screen.getByRole('heading', { name: 'Add service' })).toBeInTheDocument();
    onServiceCancelEdit.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Create service' }));

    expect(screen.queryByRole('heading', { name: 'Add service' })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Suppliers' }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.change(screen.getByLabelText('Date from'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText('Fresh Supplier')).toBeInTheDocument();
    expect(screen.queryByText('Old Supplier')).not.toBeInTheDocument();
  });
});
