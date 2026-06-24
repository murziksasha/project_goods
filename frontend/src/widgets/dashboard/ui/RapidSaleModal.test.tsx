import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import { getServiceCatalogItems } from '../../../entities/service-catalog/api/serviceCatalogApi';
import { RapidSaleModal } from './RapidSaleModal';

vi.mock('../../../entities/service-catalog/api/serviceCatalogApi', () => ({
  getServiceCatalogItems: vi.fn(async () => []),
  createServiceCatalogItem: vi.fn(),
}));

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
  warehouseId: '',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('RapidSaleModal', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  it('renders product and service sections', () => {
    render(
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
    render(
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
    render(
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
    expect(getServiceCatalogItems).not.toHaveBeenCalled();
  });

  it('allows editing draft item price before issuing', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn(async () => undefined);
    render(
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