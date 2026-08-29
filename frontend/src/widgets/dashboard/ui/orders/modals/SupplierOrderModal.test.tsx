import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProduct } from '../../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../../entities/supplier/model/types';
import type { SupplierOrder } from '../../../../../entities/supplier-order/model/types';
import { SupplierOrderModal } from './SupplierOrderModal';

const { getWarehouseSettingsMock, getCatalogProductsMock } = vi.hoisted(() => ({
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
    ],
  })),
  getCatalogProductsMock: vi.fn(async (): Promise<CatalogProduct[]> => []),
}));

vi.mock(
  '../../../../../entities/warehouse-settings/api/warehouseSettingsApi',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../../../entities/warehouse-settings/api/warehouseSettingsApi')
    >();
    return {
      ...actual,
      getWarehouseSettings: getWarehouseSettingsMock,
    };
  },
);

vi.mock(
  '../../../../../entities/catalog-product/api/catalogProductApi',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../../../entities/catalog-product/api/catalogProductApi')
    >();
    return {
      ...actual,
      getCatalogProducts: getCatalogProductsMock,
    };
  },
);

const supplier = (): Supplier => ({
  id: 'supplier-1',
  phone: '+380501112233',
  phones: ['+380501112233'],
  name: 'Aliexpress',
  note: '',
  supplierOrder: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const warehouseOptions = [
  {
    id: 'wh-main',
    name: 'Main warehouse',
    locations: [{ id: 'loc-1', name: 'Shelf A' }],
  },
];

const baseProps = () => ({
  isOpen: true,
  suppliers: [supplier()],
  warehouseOptions,
  onClose: vi.fn(),
  onCreateSupplier: vi.fn(async () => true),
  onSubmit: vi.fn(),
  onSuccess: vi.fn(),
  onError: vi.fn(),
});

const renderModal = (ui: ReactElement) => render(ui);

const getActiveProductRow = (container: HTMLElement) =>
  container.querySelector('.supplier-order-product-row') as HTMLElement;

const getStepperInput = (root: HTMLElement, label: string) =>
  within(root).getByRole('textbox', { name: label });

const clickStepperIncrement = (input: HTMLElement) => {
  const stepper = input.closest('.number-stepper') as HTMLElement;
  const incrementButton = stepper.querySelector(
    '.number-stepper-controls button',
  ) as HTMLButtonElement;
  fireEvent.click(incrementButton);
};

describe('SupplierOrderModal price/qty steppers', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('renders NumberStepper controls for active row price and qty', () => {
    const { container } = renderModal(<SupplierOrderModal {...baseProps()} />);
    const productRow = getActiveProductRow(container);

    expect(productRow.querySelectorAll('.number-stepper')).toHaveLength(2);
    expect(getStepperInput(productRow, 'Price (UAH)')).toBeInTheDocument();
    expect(getStepperInput(productRow, 'Qty')).toBeInTheDocument();
  });

  it('increments active row qty and price by one unit', () => {
    const { container } = renderModal(<SupplierOrderModal {...baseProps()} />);
    const productRow = getActiveProductRow(container);
    const priceInput = getStepperInput(productRow, 'Price (UAH)');
    const qtyInput = getStepperInput(productRow, 'Qty');

    clickStepperIncrement(priceInput);
    clickStepperIncrement(qtyInput);

    expect(priceInput).toHaveValue('1');
    expect(qtyInput).toHaveValue('2');
  });

  it('disables active row steppers when modal is read-only', () => {
    const { container } = renderModal(
      <SupplierOrderModal {...baseProps()} forceReadOnly />,
    );
    const productRow = getActiveProductRow(container);
    const priceInput = getStepperInput(productRow, 'Price (UAH)');
    const qtyInput = getStepperInput(productRow, 'Qty');

    expect(priceInput).toBeDisabled();
    expect(qtyInput).toBeDisabled();
    const priceButtons = (
      priceInput.closest('.number-stepper') as HTMLElement
    ).querySelectorAll('.number-stepper-controls button');
    expect(priceButtons).toHaveLength(2);
    expect(Array.from(priceButtons).every((button) => button.hasAttribute('disabled'))).toBe(
      true,
    );
  });

  it('renders basket row steppers and increments qty by one', () => {
    const { container } = renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={{
          id: 'order-1',
          orderBaseId: 'SO-1',
          number: 'SO-1',
          supplierId: 'supplier-1',
          supplierName: 'Aliexpress',
          deliveryDate: '2026-11-19',
          supplyType: 'Локально',
          createdBy: 'employee-1',
          status: 'request',
          paymentStatus: 'pending',
          receiptStatus: 'new',
          note: '',
          total: 2082,
          paid: 0,
          isFavorite: false,
          items: [
            {
              lineId: 'line-1',
              itemIndex: 0,
              catalogProductId: 'catalog-1',
              productName: 'Android TV box',
              quantity: 2,
              price: 1041,
              receiptStatus: 'new',
            },
            {
              lineId: 'line-2',
              itemIndex: 1,
              catalogProductId: 'catalog-2',
              productName: 'Second item',
              quantity: 3,
              price: 500,
              receiptStatus: 'new',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    );

    const basketRows = container.querySelectorAll(
      '.supplier-order-basket-row',
    );
    expect(basketRows).toHaveLength(2);

    const secondBasketRow = basketRows[1] as HTMLElement;
    expect(secondBasketRow.querySelectorAll('.number-stepper')).toHaveLength(2);

    const qtyInput = getStepperInput(secondBasketRow, 'Qty');

    clickStepperIncrement(qtyInput);

    expect(qtyInput).toHaveValue('4');
  });

  it('keeps existing lines when adding another product while editing', async () => {
    getCatalogProductsMock.mockResolvedValue([
      {
        id: 'catalog-3',
        name: 'USB Hub 4 ports',
        note: '',
        isActive: true,
        sourceTags: [],
        lastSeenAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const { container } = renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={{
          id: 'order-1',
          orderBaseId: 'SO-1',
          number: 'SO-1',
          supplierId: 'supplier-1',
          supplierName: 'Aliexpress',
          deliveryDate: '2026-11-19',
          supplyType: 'Локально',
          createdBy: 'employee-1',
          status: 'approved',
          paymentStatus: 'pending',
          receiptStatus: 'new',
          note: '',
          total: 100,
          paid: 0,
          isFavorite: false,
          items: [
            {
              lineId: 'line-1',
              itemIndex: 0,
              catalogProductId: 'catalog-1',
              productName: 'Android TV box',
              quantity: 1,
              price: 100,
              receiptStatus: 'new',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    );

    expect(container.querySelectorAll('.supplier-order-basket-row')).toHaveLength(
      1,
    );
    expect(screen.getByDisplayValue('Android TV box')).toBeInTheDocument();

    const productInput = screen.getByPlaceholderText('Type to search and add');
    fireEvent.focus(productInput);
    fireEvent.change(productInput, { target: { value: 'USB Hub 4 ports' } });

    await waitFor(() => {
      expect(getCatalogProductsMock).toHaveBeenCalled();
    });

    const suggestion = await screen.findByText('USB Hub 4 ports');
    fireEvent.mouseDown(suggestion.closest('button') ?? suggestion);
    fireEvent.click(suggestion.closest('button') ?? suggestion);

    fireEvent.click(
      screen.getByRole('button', { name: 'Add product to order list' }),
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.supplier-order-basket-row')).toHaveLength(
        2,
      );
    });
    expect(screen.getByDisplayValue('Android TV box')).toBeInTheDocument();
    expect(screen.getByDisplayValue('USB Hub 4 ports')).toBeInTheDocument();
  });

  it('blocks take-on-charge when items are dirty vs saved order', () => {
    const onError = vi.fn();
    const onTakeOnCharge = vi.fn();
    const { container } = renderModal(
      <SupplierOrderModal
        {...baseProps()}
        onError={onError}
        onTakeOnCharge={onTakeOnCharge}
        editingOrder={{
          id: 'order-1',
          orderBaseId: 'SO-1',
          number: 'SO-1',
          supplierId: 'supplier-1',
          supplierName: 'Aliexpress',
          deliveryDate: '2026-11-19',
          supplyType: 'Локально',
          createdBy: 'employee-1',
          status: 'approved',
          paymentStatus: 'pending',
          receiptStatus: 'new',
          note: '',
          total: 100,
          paid: 0,
          isFavorite: false,
          items: [
            {
              lineId: 'line-1',
              itemIndex: 0,
              catalogProductId: 'catalog-1',
              productName: 'Android TV box',
              quantity: 1,
              price: 100,
              receiptStatus: 'new',
            },
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    );

    const basketRow = container.querySelector(
      '.supplier-order-basket-row',
    ) as HTMLElement;
    const qtyInput = getStepperInput(basketRow, 'Qty');
    clickStepperIncrement(qtyInput);

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    expect(onError).toHaveBeenCalledWith(
      'Save the order before taking it on charge. Unsaved line items are not stocked.',
    );
    expect(onTakeOnCharge).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/print serial numbers after receipt/i),
    ).not.toBeInTheDocument();
  });

  it('shows amount label for computed line total', () => {
    renderModal(<SupplierOrderModal {...baseProps()} />);

    expect(screen.getByText('Amount')).toBeInTheDocument();
  });
});

const line = (
  itemIndex: number,
  overrides: Partial<SupplierOrder['items'][number]> = {},
): SupplierOrder['items'][number] => ({
  lineId: `line-${itemIndex + 1}`,
  itemIndex,
  catalogProductId: `catalog-${itemIndex + 1}`,
  productName: `Product ${itemIndex + 1}`,
  quantity: 1,
  price: 100,
  receiptStatus: 'new',
  ...overrides,
});

const editingOrder = (
  overrides: Partial<SupplierOrder> = {},
): SupplierOrder => ({
  id: 'order-1',
  orderBaseId: 'SO-1',
  number: 'SO-1',
  supplierId: 'supplier-1',
  supplierName: 'Aliexpress',
  deliveryDate: '2026-11-19',
  supplyType: 'Локально',
  createdBy: 'employee-1',
  status: 'request',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  note: '',
  total: 100,
  paid: 0,
  isFavorite: false,
  items: [line(0)],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('SupplierOrderModal cancel actions', () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    vi.clearAllMocks();
  });

  it('shows Cancel order and Cancel item on a one-line unpaid approved order', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder({ status: 'approved' })}
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Cancel order' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cancel item' }),
    ).toBeInTheDocument();
  });

  it('shows Cancel item and hides Cancel order in item-scoped view', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder()}
        isItemScopedView
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Cancel item' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel order' }),
    ).not.toBeInTheDocument();
  });

  it('shows Cancel order only on a multi-item full order', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder({
          items: [line(0), line(1)],
          total: 200,
        })}
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Cancel order' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel item' }),
    ).not.toBeInTheDocument();
  });

  it('confirms Cancel order before calling onCancelOrder', async () => {
    const onCancelOrder = vi.fn();
    const onClose = vi.fn();
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder()}
        onCancelOrder={onCancelOrder}
        onCancelItem={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(onCancelOrder).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Cancel this supplier order? Unreceived items will be cancelled. The order is not permanently deleted.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel order' })[1]);

    await waitFor(() => {
      expect(onCancelOrder).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Cancel item on a paid one-line approved order', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder({
          status: 'approved',
          paymentStatus: 'paid',
          paid: 100,
          receiptStatus: 'approved',
          items: [line(0, { receiptStatus: 'approved' })],
        })}
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Cancel item' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel order' }),
    ).not.toBeInTheDocument();
  });

  it('hides both cancel actions on a fully received order', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder({
          status: 'stocked',
          receiptStatus: 'received',
          items: [line(0, { receiptStatus: 'received' })],
        })}
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Cancel order' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel item' }),
    ).not.toBeInTheDocument();
  });

  it('keeps Cancel item on a paid item-scoped line', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        editingOrder={editingOrder({ paymentStatus: 'paid', paid: 100 })}
        isItemScopedView
        onCancelOrder={vi.fn()}
        onCancelItem={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Cancel item' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel order' }),
    ).not.toBeInTheDocument();
  });
});