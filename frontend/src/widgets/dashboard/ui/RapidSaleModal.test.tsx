import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import { queryKeys } from '../../../shared/api/queryClient';
import { RapidSaleModal } from './RapidSaleModal';

const { getServiceCatalogItemsMock, createServiceCatalogItemMock } = vi.hoisted(() => ({
  getServiceCatalogItemsMock: vi.fn(async () => []),
  createServiceCatalogItemMock: vi.fn(),
}));

vi.mock('../../../entities/service-catalog/api/serviceCatalogApi', () => ({
  getServiceCatalogItems: getServiceCatalogItemsMock,
  createServiceCatalogItem: createServiceCatalogItemMock,
}));

const { getWarehouseSettingsMock } = vi.hoisted(() => ({
  getWarehouseSettingsMock: vi.fn(async () => ({
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
      {
        id: 'wh-second',
        name: 'Second warehouse',
        isActive: true,
        serviceCenterId: 'sc-1',
        receiptAddress: '',
        receiptPhone: '',
        locations: [{ id: 'loc-2', name: 'Shelf B' }],
      },
    ],
  })),
}));

vi.mock('../../../entities/warehouse-settings/api/warehouseSettingsApi', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('../../../entities/warehouse-settings/api/warehouseSettingsApi')
  >();
  return {
    ...actual,
    getWarehouseSettings: getWarehouseSettingsMock,
  };
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Cable',
  article: 'CBL-1',
  serialNumber: '',
  price: 100,
  salePriceOptions: [120],
  note: '',
  quantity: 2,
  reservedQuantity: 0,
  freeQuantity: 2,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'wh-main',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const warehouseSettingsFixture = {
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
    {
      id: 'wh-second',
      name: 'Second warehouse',
      isActive: true,
      serviceCenterId: 'sc-1',
      receiptAddress: '',
      receiptPhone: '',
      locations: [{ id: 'loc-2', name: 'Shelf B' }],
    },
  ],
};

const renderModal = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.warehouseSettings, warehouseSettingsFixture);

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('RapidSaleModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  it('renders product and service sections', () => {
    renderModal(
      <RapidSaleModal
        products={[product()]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issued' })).toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal(
      <RapidSaleModal
        products={[product()]}
        sales={[]}
        isSaving={false}
        onClose={onClose}
        onSubmit={vi.fn(async () => undefined)}
        onError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submits draft items on issued', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => undefined);
    renderModal(
      <RapidSaleModal
        products={[product()]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    const searchInput = within(dialog).getByPlaceholderText('Name, serial or article');
    fireEvent.change(searchInput, { target: { value: 'Cable' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cable' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));
    expect(within(dialog).getByRole('button', { name: 'Issued' })).not.toBeDisabled();

    vi.useRealTimers();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Issued' }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'product',
          productId: 'p1',
          name: 'Cable',
        }),
      ]);
    });
    expect(getServiceCatalogItemsMock).not.toHaveBeenCalled();
  });

  it('keeps serialized product in entry row until add is confirmed', async () => {
    vi.useFakeTimers();
    renderModal(
      <RapidSaleModal
        products={[
          product({
            name: 'iPhone 14',
            serialNumber: 'S000003',
            price: 1000,
            salePriceOptions: [1000],
          }),
        ]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'iPhone' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'iPhone 14' }));

    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Product price')).toHaveValue('1000');
    expect(within(dialog).getByLabelText('Product quantity')).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Add product' })).not.toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Issued' })).toBeDisabled();

    vi.useRealTimers();
  });

  it('adds serialized product with serial numbers on confirm', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => undefined);
    renderModal(
      <RapidSaleModal
        products={[
          product({
            name: 'iPhone 14',
            serialNumber: 'S000003',
            price: 1000,
            salePriceOptions: [1000],
          }),
        ]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'iPhone' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'iPhone 14' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));

    expect(within(dialog).getByText('iPhone 14 (S000003)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Issued' })).not.toBeDisabled();

    vi.useRealTimers();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Issued' }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'product',
          productId: 'p1',
          name: 'iPhone 14',
          serialNumbers: ['S000003'],
        }),
      ]);
    });
  });

  it('allows editing entry-row price for serialized product before add', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => undefined);
    renderModal(
      <RapidSaleModal
        products={[
          product({
            name: 'iPhone 14',
            serialNumber: 'S000003',
            price: 1000,
            salePriceOptions: [1000],
          }),
        ]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'iPhone' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'iPhone 14' }));
    fireEvent.change(within(dialog).getByLabelText('Product price'), {
      target: { value: '1200' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));

    expect(within(dialog).getByText('Total: 1200 UAH')).toBeInTheDocument();

    vi.useRealTimers();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Issued' }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'product',
          price: '1200',
          serialNumbers: ['S000003'],
        }),
      ]);
    });
  });

  it('clears serial binding when product search text changes', async () => {
    vi.useFakeTimers();
    renderModal(
      <RapidSaleModal
        products={[
          product({
            name: 'iPhone 14',
            serialNumber: 'S000003',
            price: 1000,
            salePriceOptions: [1000],
          }),
        ]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    const searchInput = within(dialog).getByPlaceholderText('Name, serial or article');
    fireEvent.change(searchInput, { target: { value: 'iPhone' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'iPhone 14' }));
    expect(within(dialog).getByLabelText('Product quantity')).toBeDisabled();

    fireEvent.change(searchInput, { target: { value: 'iPhone 15' } });
    expect(within(dialog).getByLabelText('Product quantity')).not.toBeDisabled();

    vi.useRealTimers();
  });

  it('filters product suggestions by selected warehouse', async () => {
    renderModal(
      <RapidSaleModal
        products={[
          product({
            id: 'p-main',
            name: 'Router',
            warehouseId: 'wh-main',
            serialNumber: 'S000001',
            salePriceOptions: [100],
          }),
          product({
            id: 'p-second',
            name: 'Router',
            warehouseId: 'wh-second',
            serialNumber: 'S000002',
            salePriceOptions: [100],
          }),
        ]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    await waitFor(() => {
      expect(within(dialog).getByLabelText('Warehouse')).toHaveValue('wh-main');
    });

    vi.useFakeTimers();
    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'Router' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(within(dialog).getByRole('button', { name: 'Router' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(/S000001/),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/S000002/)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Warehouse'), {
      target: { value: 'wh-second' },
    });

    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'Router' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(within(dialog).getByText(/S000002/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/S000001/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('allows editing draft item price before issuing', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => undefined);
    renderModal(
      <RapidSaleModal
        products={[product()]}
        sales={[]}
        isSaving={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        onError={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Rapid sale' });
    fireEvent.change(within(dialog).getByPlaceholderText('Name, serial or article'), {
      target: { value: 'Cable' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cable' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add product' }));

    const draftPriceInput = within(dialog).getByLabelText('Cable Price');
    fireEvent.change(draftPriceInput, { target: { value: '150' } });

    expect(within(dialog).getByText('Total: 150 UAH')).toBeInTheDocument();

    vi.useRealTimers();
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Issued' }));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: 'product',
          productId: 'p1',
          price: '150',
        }),
      ]);
    });
  });
});