import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import { ProductCatalogPanel } from './ProductCatalogPanel';

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

const renderPanel = ({
  clientDevices = [],
  searchQuery = '',
}: {
  clientDevices?: ClientDevice[];
  searchQuery?: string;
} = {}) =>
  render(
    <ProductCatalogPanel
      products={[]}
      clientDevices={clientDevices}
      catalogProducts={[]}
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
      onServiceCancelEdit={vi.fn()}
      onServiceEdit={vi.fn()}
      onServiceArchive={vi.fn()}
      onServiceActivate={vi.fn()}
      suppliers={[]}
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
});
