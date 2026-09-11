import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../../entities/product/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import type { WarehouseItem } from '../../../../../entities/warehouse-settings/model/types';
import * as clipboard from '../../../../../shared/lib/clipboard';
import { SerialBindModal } from './SerialBindModal';

const warehouse = (patch: Partial<WarehouseItem> = {}): WarehouseItem => ({
  id: 'wh-main',
  name: 'Main warehouse',
  isActive: true,
  serviceCenterId: 'sc-1',
  receiptAddress: '',
  receiptPhone: '',
  locations: [{ id: 'loc-1', name: 'Shelf A' }],
  ...patch,
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Cable',
  article: 'CBL',
  serialNumber: 'S000001',
  price: 100,
  salePriceOptions: [120],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'wh-main',
  locationId: 'loc-1',
  purchaseDate: '2026-01-01T00:00:00.000Z',
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const supplierOrder = (
  patch: Partial<SupplierOrder> = {},
): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Linked supplier',
  deliveryDate: '2026-01-01T00:00:00.000Z',
  supplyType: 'Local',
  number: 'SO-1',
  note: '',
  createdBy: 'Owner',
  status: 'stocked',
  paymentStatus: 'pending',
  receiptStatus: 'received',
  total: 250,
  paid: 0,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'Cable',
      quantity: 1,
      price: 250,
      receiptStatus: 'received',
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const linkedProduct = (patch: Partial<Product> = {}) =>
  product({
    price: 250,
    supplierOrderId: 'so-1',
    supplierOrderItemIndex: 0,
    ...patch,
  });

describe('SerialBindModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('defaults to first warehouse and filters serial list by selection', () => {
    const warehouses = [
      warehouse({ id: 'wh-main', name: 'Main warehouse' }),
      warehouse({ id: 'wh-second', name: 'Second warehouse' }),
    ];
    const availableProducts = [
      product({ id: 'p-main', warehouseId: 'wh-main', serialNumber: 'S000001' }),
      product({ id: 'p-second', warehouseId: 'wh-second', serialNumber: 'S000002' }),
    ];

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 2,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={warehouses}
        availableProducts={availableProducts}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Warehouse')).toHaveValue('wh-main');
    expect(screen.getByRole('button', { name: /\[ \] S000001/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\[ \] S000002/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Warehouse'), {
      target: { value: 'wh-second' },
    });

    expect(screen.getByRole('button', { name: /\[ \] S000002/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\[ \] S000001/i })).not.toBeInTheDocument();
  });

  it('auto-select oldest respects the selected warehouse', () => {
    const warehouses = [
      warehouse({ id: 'wh-main', name: 'Main warehouse' }),
      warehouse({ id: 'wh-second', name: 'Second warehouse' }),
    ];
    const availableProducts = [
      product({
        id: 'p-main',
        warehouseId: 'wh-main',
        serialNumber: 'S000001',
        purchaseDate: '2026-01-01T00:00:00.000Z',
      }),
      product({
        id: 'p-second-old',
        warehouseId: 'wh-second',
        serialNumber: 'S000002',
        purchaseDate: '2026-02-01T00:00:00.000Z',
      }),
      product({
        id: 'p-second-new',
        warehouseId: 'wh-second',
        serialNumber: 'S000003',
        purchaseDate: '2026-03-01T00:00:00.000Z',
      }),
    ];

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 2,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={warehouses}
        availableProducts={availableProducts}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Warehouse'), {
      target: { value: 'wh-second' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Auto-select oldest' }),
    );

    expect(
      screen.getAllByText(/S00000[23]/, {
        selector: '.serial-bind-selected-item strong',
      }),
    ).toHaveLength(2);
    expect(
      screen.queryByText('S000001', {
        selector: '.serial-bind-selected-item strong',
      }),
    ).not.toBeInTheDocument();
  });

  it('calls onSave with selected serials', () => {
    const onSave = vi.fn();
    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 1,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={[warehouse()]}
        availableProducts={[product({ serialNumber: 'S000001' })]}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={onSave}
        onError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /\[ \] S000001/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(['S000001']);
  });

  it('shows purchase price and a clickable copyable supplier order number', () => {
    const onOpenSupplierOrder = vi.fn();

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 1,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={[warehouse()]}
        availableProducts={[linkedProduct()]}
        supplierOrders={[supplierOrder()]}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
        onOpenSupplierOrder={onOpenSupplierOrder}
      />,
    );

    expect(
      document.querySelector('.serial-bind-candidate-price'),
    ).toHaveTextContent(/250,00/);
    expect(screen.getByRole('button', { name: 'SO-1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SO-1' }));
    expect(onOpenSupplierOrder).toHaveBeenCalledWith('so-1', 0);
    expect(
      screen.queryByText('S000001', {
        selector: '.serial-bind-selected-item strong',
      }),
    ).not.toBeInTheDocument();
  });

  it('renders an empty supplier order cell without copy or click', () => {
    const onOpenSupplierOrder = vi.fn();

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 1,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={[warehouse()]}
        availableProducts={[product({ price: 100 })]}
        supplierOrders={[supplierOrder()]}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
        onOpenSupplierOrder={onOpenSupplierOrder}
      />,
    );

    expect(screen.getByText('\u2014')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'SO-1' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy' })).toBeNull();
    expect(onOpenSupplierOrder).not.toHaveBeenCalled();
  });

  it('copies the supplier order number from the hover icon without selecting the serial', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <SerialBindModal
        lineItem={{
          id: 'line-1',
          name: 'Cable',
          quantity: 1,
          price: 100,
          warrantyPeriod: 0,
        }}
        warehouses={[warehouse()]}
        availableProducts={[linkedProduct()]}
        supplierOrders={[supplierOrder()]}
        isLoading={false}
        isSuppliersLoading={false}
        onClose={vi.fn()}
        onOrder={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
        onOpenSupplierOrder={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
    });
    expect(copySpy).toHaveBeenCalledWith('SO-1');
    expect(
      screen.queryByText('S000001', {
        selector: '.serial-bind-selected-item strong',
      }),
    ).not.toBeInTheDocument();
  });
});