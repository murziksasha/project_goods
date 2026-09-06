import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../entities/product/model/types';
import type {
  ProductWarehouseMeta,
  TransferFormState,
  TransferHistoryRow,
  WarehouseItem,
} from '../../model/warehouse-panel';
import { TransferWorkspace } from './WarehouseTransferWorkspace';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const product: Product = {
  id: 'product-1',
  name: 'iPhone 15',
  article: 'ART-001',
  serialNumber: 'SN-12345',
  price: 500,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: 'Supplier',
  purchaseDate: '2026-06-01T09:00:00.000Z',
  warrantyPeriod: 12,
  isActive: true,
  createdAt: '2026-06-01T09:00:00.000Z',
  updatedAt: '2026-06-01T09:00:00.000Z',
};

const warehouses: WarehouseItem[] = [
  {
    id: 'w-1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-1', name: 'A1' }],
  },
  {
    id: 'w-2',
    name: 'Shop',
    isActive: true,
    serviceCenterId: 'sc-1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l-2', name: 'Counter' }],
  },
];

const meta: Record<string, ProductWarehouseMeta> = {
  'product-1': {
    warehouseId: 'w-1',
    warehouseName: 'Main',
    locationId: 'l-1',
    locationName: 'A1',
  },
};

const historyRow: TransferHistoryRow = {
  id: 'transfer-1',
  productName: 'iPhone 15',
  serialNumber: 'SN-12345',
  fromWarehouseName: 'Main',
  fromLocationName: 'A1',
  toWarehouseName: 'Shop',
  toLocationName: 'Counter',
  note: 'Move',
  createdAt: '2026-06-01T09:00:00.000Z',
  createdBy: 'Owner',
};

const renderWorkspace = (
  overrides?: Partial<
    Parameters<typeof TransferWorkspace>[0]
  > & { form?: TransferFormState },
) => {
  const onFormChange = vi.fn();
  const onSubmit = vi.fn();
  const form: TransferFormState = overrides?.form ?? {
    productId: '',
    toWarehouseId: '',
    toLocationId: '',
    note: '',
  };
  render(
    <TransferWorkspace
      products={overrides?.products ?? [product]}
      selectableProducts={overrides?.selectableProducts ?? [product]}
      warehouses={overrides?.warehouses ?? warehouses}
      productWarehouseMetaById={overrides?.productWarehouseMetaById ?? meta}
      form={form}
      selectedProduct={overrides?.selectedProduct ?? null}
      targetLocations={overrides?.targetLocations ?? []}
      history={overrides?.history ?? []}
      isSaving={overrides?.isSaving ?? false}
      onFormChange={onFormChange}
      onSubmit={onSubmit}
    />,
  );
  return { onFormChange, onSubmit };
};

describe('TransferWorkspace', () => {
  it('shows empty stock and history copy', () => {
    renderWorkspace({ products: [], selectableProducts: [], history: [] });
    expect(screen.getByText('No stock rows found.')).toBeTruthy();
    expect(screen.getByText('No transfers in this session.')).toBeTruthy();
    expect(screen.getByText('Select a stock item to transfer.')).toBeTruthy();
  });

  it('selecting a stock row fills the product id', () => {
    const { onFormChange } = renderWorkspace();
    fireEvent.click(screen.getByText('iPhone 15'));
    expect(onFormChange).toHaveBeenCalledTimes(1);
    const updater = onFormChange.mock.calls[0][0] as (
      current: TransferFormState,
    ) => TransferFormState;
    expect(
      updater({
        productId: '',
        toWarehouseId: '',
        toLocationId: '',
        note: '',
      }),
    ).toMatchObject({ productId: 'product-1' });
  });

  it('disables submit and warns when the target is the current location', () => {
    renderWorkspace({
      form: {
        productId: 'product-1',
        toWarehouseId: 'w-1',
        toLocationId: 'l-1',
        note: '',
      },
      selectedProduct: product,
      targetLocations: warehouses[0].locations,
    });
    expect(
      screen.getByText('Product is already in the selected location.'),
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Transfer stock' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('adds data-label attributes and session destination bars', () => {
    renderWorkspace({
      form: {
        productId: 'product-1',
        toWarehouseId: 'w-2',
        toLocationId: 'l-2',
        note: '',
      },
      selectedProduct: product,
      targetLocations: warehouses[1].locations,
      history: [historyRow],
    });
    expect(screen.getAllByText('Shop / Counter').length).toBeGreaterThan(0);
    expect(document.querySelector('td[data-label="Product"]')).toBeTruthy();
    expect(document.querySelector('td[data-label="From"]')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Transfer stock' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
});
