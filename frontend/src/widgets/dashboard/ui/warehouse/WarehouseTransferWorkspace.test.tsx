import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../../entities/product';
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
      batchMode={overrides?.batchMode}
      batchProducts={overrides?.batchProducts}
      onRemoveBatchItem={overrides?.onRemoveBatchItem}
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

describe('TransferWorkspace batch mode', () => {
  const p1: Product = {
    ...product,
    id: 'prod-1',
    name: 'TerraE 30E',
    serialNumber: 'S001',
  };
  const p2: Product = {
    ...product,
    id: 'prod-2',
    name: 'TerraE 30E',
    serialNumber: 'S002',
  };
  const batchMeta: Record<string, ProductWarehouseMeta> = {
    'prod-1': {
      warehouseId: 'w-1',
      warehouseName: 'Main',
      locationId: 'l-1',
      locationName: 'A1',
    },
    'prod-2': {
      warehouseId: 'w-2',
      warehouseName: 'Shop',
      locationId: 'l-2',
      locationName: 'Counter',
    },
  };

  it('hides single-product dropdown and displays batch table with serials and locations', () => {
    const onRemoveBatchItem = vi.fn();
    renderWorkspace({
      batchMode: { type: 'group', groupId: 'terrae-30e' },
      batchProducts: [p1, p2],
      productWarehouseMetaById: batchMeta,
      onRemoveBatchItem,
    });

    // Dropdown is hidden
    expect(
      screen.queryByRole('combobox', { name: /product/i }),
    ).not.toBeInTheDocument();

    // Table lists both products with serials
    expect(screen.getByText('S001')).toBeInTheDocument();
    expect(screen.getByText('S002')).toBeInTheDocument();

    // Remove buttons are present
    const removeButtons = screen.getAllByRole('button', {
      name: /remove|видалити/i,
    });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);
    expect(onRemoveBatchItem).toHaveBeenCalledWith(p1);
  });

  it('marks stays when target destination matches, displays movers count on submit, and disables submit at 0 movers', () => {
    const onSubmit = vi.fn();

    // Target is w-1 / l-1 (Main / A1): prod-1 stays, prod-2 moves (1 mover)
    const { rerender } = render(
      <TransferWorkspace
        products={[p1, p2]}
        selectableProducts={[p1, p2]}
        warehouses={warehouses}
        productWarehouseMetaById={batchMeta}
        form={{
          productId: '',
          toWarehouseId: 'w-1',
          toLocationId: 'l-1',
          note: '',
        }}
        selectedProduct={null}
        targetLocations={warehouses[0].locations}
        history={[]}
        isSaving={false}
        onFormChange={vi.fn()}
        onSubmit={onSubmit}
        batchMode={{ type: 'group', groupId: 'terrae-30e' }}
        batchProducts={[p1, p2]}
        onRemoveBatchItem={vi.fn()}
      />,
    );

    // Stays badge on prod-1
    expect(document.querySelector('.warehouse-data-badge-stay')).toHaveTextContent(/stays|залишається/i);

    // Submit button shows "Transfer 1"
    const submitBtn = screen.getByRole('button', {
      name: /transfer 1|перемістити 1/i,
    }) as HTMLButtonElement;
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn.disabled).toBe(false);

    // Now change batch to only prod-1 (which stays at w-1 / l-1) -> 0 movers
    rerender(
      <TransferWorkspace
        products={[p1, p2]}
        selectableProducts={[p1, p2]}
        warehouses={warehouses}
        productWarehouseMetaById={batchMeta}
        form={{
          productId: '',
          toWarehouseId: 'w-1',
          toLocationId: 'l-1',
          note: '',
        }}
        selectedProduct={null}
        targetLocations={warehouses[0].locations}
        history={[]}
        isSaving={false}
        onFormChange={vi.fn()}
        onSubmit={onSubmit}
        batchMode={{ type: 'group', groupId: 'terrae-30e' }}
        batchProducts={[p1]}
        onRemoveBatchItem={vi.fn()}
      />,
    );

    const submitBtnDisabled = screen.getByRole('button', {
      name: /transfer 0|перемістити 0/i,
    }) as HTMLButtonElement;
    expect(submitBtnDisabled).toBeInTheDocument();
    expect(submitBtnDisabled.disabled).toBe(true);
  });
});
