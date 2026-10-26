import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProduct } from '../../../../../entities/catalog-product';
import type { Supplier } from '../../../../../entities/supplier';
import type { SupplierOrder } from '../../../../../entities/supplier-order';
import { SupplierOrderModal } from './SupplierOrderModal';
import { STOCK_RECEIPT_STORAGE_KEY } from '../../../model/stock-receipt-preferences';

const { getWarehouseSettingsMock, getCatalogProductsMock } =
  vi.hoisted(() => ({
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
    getCatalogProductsMock: vi.fn(
      async (): Promise<CatalogProduct[]> => [],
    ),
  }));

vi.mock(
  '../../../../../entities/warehouse-settings',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../../entities/warehouse-settings')
      >();
    return {
      ...actual,
      getWarehouseSettings: getWarehouseSettingsMock,
    };
  },
);

vi.mock(
  '../../../../../entities/catalog-product',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('../../../../../entities/catalog-product')
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
  container.querySelector(
    '.supplier-order-product-row',
  ) as HTMLElement;

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
    vi.useRealTimers();
  });

  it('renders NumberStepper controls for active row price and qty', () => {
    const { container } = renderModal(
      <SupplierOrderModal {...baseProps()} />,
    );
    const productRow = getActiveProductRow(container);

    expect(
      productRow.querySelectorAll('.number-stepper'),
    ).toHaveLength(2);
    expect(
      getStepperInput(productRow, 'Price (UAH)'),
    ).toBeInTheDocument();
    expect(getStepperInput(productRow, 'Qty')).toBeInTheDocument();
  });

  it('increments active row qty and price by one unit', () => {
    const { container } = renderModal(
      <SupplierOrderModal {...baseProps()} />,
    );
    const productRow = getActiveProductRow(container);
    const priceInput = getStepperInput(productRow, 'Price (UAH)');
    const qtyInput = getStepperInput(productRow, 'Qty');

    clickStepperIncrement(priceInput);
    clickStepperIncrement(qtyInput);

    expect(priceInput).toHaveValue('1');
    expect(qtyInput).toHaveValue('2');
  });

  it('dismisses supplier suggestions on outside click and keeps the typed name', async () => {
    vi.useFakeTimers();
    renderModal(<SupplierOrderModal {...baseProps()} />);

    const supplierInput = screen.getByPlaceholderText('Search');
    fireEvent.change(supplierInput, { target: { value: 'Al' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(
      screen.getByRole('button', { name: /Aliexpress/i }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText('Delivery date'));
    expect(
      screen.queryByRole('button', { name: /Aliexpress/i }),
    ).not.toBeInTheDocument();
    expect(supplierInput).toHaveValue('Al');

    vi.useRealTimers();
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
    expect(
      Array.from(priceButtons).every((button) =>
        button.hasAttribute('disabled'),
      ),
    ).toBe(true);
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
    expect(
      secondBasketRow.querySelectorAll('.number-stepper'),
    ).toHaveLength(2);

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

    expect(
      container.querySelectorAll('.supplier-order-basket-row'),
    ).toHaveLength(1);
    expect(
      screen.getByDisplayValue('Android TV box'),
    ).toBeInTheDocument();

    const productInput = screen.getByPlaceholderText(
      'Type to search and add',
    );
    fireEvent.focus(productInput);
    fireEvent.change(productInput, {
      target: { value: 'USB Hub 4 ports' },
    });

    await waitFor(() => {
      expect(getCatalogProductsMock).toHaveBeenCalled();
    });

    const suggestion = await screen.findByText('USB Hub 4 ports');
    fireEvent.mouseDown(suggestion.closest('button') ?? suggestion);
    fireEvent.click(suggestion.closest('button') ?? suggestion);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Add product to order list',
      }),
    );

    await waitFor(() => {
      expect(
        container.querySelectorAll('.supplier-order-basket-row'),
      ).toHaveLength(2);
    });
    expect(
      screen.getByDisplayValue('Android TV box'),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('USB Hub 4 ports'),
    ).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole('button', { name: 'Receive to stock' }),
    );

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

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel order' }),
    );
    expect(onCancelOrder).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Cancel this supplier order? Unreceived items will be cancelled. The order is not permanently deleted.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Cancel order' })[1],
    );

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
        editingOrder={editingOrder({
          paymentStatus: 'paid',
          paid: 100,
        })}
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

describe('SupplierOrderModal supplier suggestions reorder and navigation', () => {
  const suppliersList: Supplier[] = [
    {
      id: 'supp-1',
      name: 'Supplier Alpha',
      phone: '+380501111111',
      phones: ['+380501111111'],
      note: '',
      supplierOrder: '',
      isActive: true,
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'supp-2',
      name: 'Supplier Beta',
      phone: '+380502222222',
      phones: ['+380502222222'],
      note: '',
      supplierOrder: '',
      isActive: true,
      sortOrder: 1,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  it('navigates suggestions with ArrowDown and selects with Enter', async () => {
    vi.useFakeTimers();
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        suppliers={suppliersList}
      />,
    );

    const supplierInput = screen.getByPlaceholderText('Search');
    fireEvent.change(supplierInput, {
      target: { value: 'Supplier' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(
      screen.getByRole('button', { name: 'Supplier Alpha' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Supplier Beta' }),
    ).toBeInTheDocument();

    // Navigate to first suggestion
    fireEvent.keyDown(supplierInput, { key: 'ArrowDown' });
    // Navigate to second suggestion
    fireEvent.keyDown(supplierInput, { key: 'ArrowDown' });
    // Select second suggestion
    fireEvent.keyDown(supplierInput, { key: 'Enter' });

    expect(supplierInput).toHaveValue('Supplier Beta');
    expect(
      screen.queryByRole('button', { name: 'Supplier Alpha' }),
    ).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('reorders suggestions with shift button and calls onReorderSuppliers', async () => {
    vi.useFakeTimers();
    const onReorderSuppliers = vi.fn(async () => {});
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        suppliers={suppliersList}
        onReorderSuppliers={onReorderSuppliers}
      />,
    );

    const supplierInput = screen.getByPlaceholderText('Search');
    fireEvent.change(supplierInput, {
      target: { value: 'Supplier' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const moveDownButtons = screen.getAllByRole('button', {
      name: 'Move down',
    });
    expect(moveDownButtons).toHaveLength(2);
    fireEvent.click(moveDownButtons[0]!);

    expect(onReorderSuppliers).toHaveBeenCalledTimes(1);
    expect(onReorderSuppliers).toHaveBeenCalledWith([
      suppliersList[1],
      suppliersList[0],
    ]);

    vi.useRealTimers();
  });

  it('reorders suggestions with drag and drop', async () => {
    vi.useFakeTimers();
    const onReorderSuppliers = vi.fn(async () => {});
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        suppliers={suppliersList}
        onReorderSuppliers={onReorderSuppliers}
      />,
    );

    const supplierInput = screen.getByPlaceholderText('Search');
    fireEvent.change(supplierInput, {
      target: { value: 'Supplier' },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    const dragHandles = screen.getAllByRole('button', {
      name: 'Drag to reorder',
    });
    expect(dragHandles).toHaveLength(2);

    const dataTransfer = {
      effectAllowed: '',
      setData: vi.fn(),
      dropEffect: '',
    };

    fireEvent.dragStart(dragHandles[0]!, { dataTransfer });
    const suggestionItems = document.querySelectorAll(
      '.reorderable-suggestion-item',
    );
    expect(suggestionItems).toHaveLength(2);
    fireEvent.dragOver(suggestionItems[1]!, { dataTransfer });
    fireEvent.drop(suggestionItems[1]!, { dataTransfer });
    fireEvent.dragEnd(dragHandles[0]!);

    expect(onReorderSuppliers).toHaveBeenCalledTimes(1);
    expect(onReorderSuppliers).toHaveBeenCalledWith([
      suppliersList[1],
      suppliersList[0],
    ]);

    vi.useRealTimers();
  });

  it('initializes stock receipt article checkboxes based on quantity > 1 vs = 1 and forwards payload', async () => {
    const onTakeOnCharge = vi.fn().mockResolvedValue(undefined);
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
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
          total: 300,
          paid: 0,
          isFavorite: false,
          items: [
            line(0, { productName: 'Single Item', quantity: 1, price: 100 }),
            line(1, { productName: 'Multi Item', quantity: 2, price: 100 }),
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    );

    // Open stock receipt modal
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Stock receipt modal should be visible
    expect(screen.getByText('Stock receipt')).toBeInTheDocument();

    // Verify hints:
    // Item 1 (qty 1) -> unchecked -> "Leave blank for no article"
    // Item 2 (qty 2) -> checked -> "Leave blank to auto-generate"
    expect(screen.getByText('Leave blank for no article')).toBeInTheDocument();
    expect(screen.getByText('Leave blank to auto-generate')).toBeInTheDocument();

    // Submitting stock receipt
    const submitButtons = screen.getAllByRole('button', {
      name: 'Receive to stock',
    });
    fireEvent.click(submitButtons[1]!);

    await waitFor(() => {
      expect(onTakeOnCharge).toHaveBeenCalledTimes(1);
    });

    expect(onTakeOnCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        groupAutoGenerateArticles: [false, true],
        groupArticles: ['', ''],
      }),
    );
  });

  it('toggles all items when master auto-articles checkbox is clicked', async () => {
    const onTakeOnCharge = vi.fn().mockResolvedValue(undefined);
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
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
          total: 200,
          paid: 0,
          isFavorite: false,
          items: [
            line(0, { productName: 'Item A', quantity: 1, price: 100 }),
            line(1, { productName: 'Item B', quantity: 1, price: 100 }),
          ],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Both are qty 1, so both hints are initially "Leave blank for no article"
    expect(screen.getAllByText('Leave blank for no article')).toHaveLength(2);

    // Toggle master "Auto-generate articles" checkbox on
    const masterCheckbox = screen.getByLabelText('Auto-generate articles');
    fireEvent.click(masterCheckbox);

    // Now both hints should be "Leave blank to auto-generate"
    expect(screen.getAllByText('Leave blank to auto-generate')).toHaveLength(2);

    // Submit
    const modalSubmitButtons = screen.getAllByRole('button', {
      name: 'Receive to stock',
    });
    fireEvent.click(modalSubmitButtons[1]!);

    await waitFor(() => {
      expect(onTakeOnCharge).toHaveBeenCalledWith(
        expect.objectContaining({
          groupAutoGenerateArticles: [true, true],
        }),
      );
    });
  });
});

describe('SupplierOrderModal stock receipt localStorage preferences', () => {
  const multiWarehouseOptions = [
    {
      id: 'wh-1',
      name: 'Warehouse 1',
      locations: [
        { id: 'loc-1-1', name: 'Shelf 1-1' },
        { id: 'loc-1-2', name: 'Shelf 1-2' },
      ],
    },
    {
      id: 'wh-2',
      name: 'Warehouse 2',
      locations: [{ id: 'loc-2-1', name: 'Shelf 2-1' }],
    },
    {
      id: 'wh-empty',
      name: 'Warehouse Empty',
      locations: [],
    },
  ];

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('empty storage keeps today\'s defaults and does not write to storage', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [
            line(0, { productName: 'Single Item', quantity: 1, price: 50 }),
            line(1, { productName: 'Multi Item', quantity: 3, price: 100 }),
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    expect(screen.getByText('Stock receipt')).toBeInTheDocument();

    const autoSerialCheckbox = screen.getByLabelText('Auto-generate serial numbers');
    expect(autoSerialCheckbox).toBeChecked();

    const printSerialsCheckbox = screen.getByLabelText('Print serial numbers after receipt');
    expect(printSerialsCheckbox).toBeChecked();

    const warehouseSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement;
    expect(warehouseSelect.value).toBe('wh-1');

    const locationSelect = screen.getByLabelText('Location') as HTMLSelectElement;
    expect(locationSelect.value).toBe('loc-1-1');

    // Quantity rule defaults:
    // line 0 (qty 1) -> unchecked -> hint: "Leave blank for no article"
    // line 1 (qty 3) -> checked -> hint: "Leave blank to auto-generate"
    expect(screen.getByText('Leave blank for no article')).toBeInTheDocument();
    expect(screen.getByText('Leave blank to auto-generate')).toBeInTheDocument();

    // Top auto-articles is checked only if all lines are checked (here line 0 is false, so master is false)
    const masterAutoArticlesCheckbox = screen.getByLabelText('Auto-generate articles');
    expect(masterAutoArticlesCheckbox).not.toBeChecked();

    // Storage is untouched
    expect(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY)).toBeNull();
  });

  it('changing a top checkbox survives close and reopen', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [line(0, { productName: 'Item A', quantity: 1, price: 100 })],
        })}
      />,
    );

    // Open stock receipt
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Uncheck top Auto-generate serial numbers
    const autoSerialCheckbox = screen.getByLabelText('Auto-generate serial numbers');
    expect(autoSerialCheckbox).toBeChecked();
    fireEvent.click(autoSerialCheckbox);
    expect(autoSerialCheckbox).not.toBeChecked();

    // Uncheck print serials
    const printSerialsCheckbox = screen.getByLabelText('Print serial numbers after receipt');
    expect(printSerialsCheckbox).toBeChecked();
    fireEvent.click(printSerialsCheckbox);
    expect(printSerialsCheckbox).not.toBeChecked();

    // Check storage has updated
    const saved = JSON.parse(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}');
    expect(saved).toEqual(
      expect.objectContaining({
        autoGenerateSerialNumbers: false,
        printSerialNumbers: false,
      }),
    );

    // Close dialog
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Stock receipt')).not.toBeInTheDocument();

    // Reopen dialog
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));
    expect(screen.getByText('Stock receipt')).toBeInTheDocument();

    // The choices survived close and reopen
    expect(screen.getByLabelText('Auto-generate serial numbers')).not.toBeChecked();
    expect(screen.getByLabelText('Print serial numbers after receipt')).not.toBeChecked();
  });

  it('a multi-line per-item click does not write to storage', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [
            line(0, { productName: 'Item A', quantity: 1, price: 100 }),
            line(1, { productName: 'Item B', quantity: 1, price: 100 }),
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Both are qty 1, so both are unchecked initially
    const getPerItemToggles = () =>
      screen
        .getAllByText('Auto-generate article')
        .map((el) => el.closest('.supplier-item-article-toggle')!.querySelector('input')!);

    const perItemToggles = getPerItemToggles();
    expect(perItemToggles).toHaveLength(2);
    expect(perItemToggles[0]).not.toBeChecked();
    expect(perItemToggles[1]).not.toBeChecked();

    // Click line 0 per-item checkbox
    fireEvent.click(perItemToggles[0]!);
    expect(perItemToggles[0]).toBeChecked();

    // Storage is NOT written on per-line toggle
    expect(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY)).toBeNull();

    // Click line 1 per-item checkbox, making all lines checked
    fireEvent.click(perItemToggles[1]!);
    expect(perItemToggles[1]).toBeChecked();

    // Master checkbox derives to checked, but storage stays unchanged
    expect(screen.getByLabelText('Auto-generate articles')).toBeChecked();
    expect(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY)).toBeNull();

    // Close and reopen: because nothing was stored, quantity rule re-applies (both start unchecked)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    const reopenedToggles = getPerItemToggles();
    expect(reopenedToggles[0]).not.toBeChecked();
    expect(reopenedToggles[1]).not.toBeChecked();
  });

  it('a one-line side checkbox writes storage and applies to next open', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [line(0, { productName: 'Item A', quantity: 2, price: 100 })],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    const getSideCheckbox = () =>
      screen.getByText('Auto-generate article').closest('.supplier-item-article-toggle')!.querySelector('input')!;

    // Single item with qty 2 defaults to autoArticle: true
    const sideCheckbox = getSideCheckbox();
    expect(sideCheckbox).toBeChecked();

    // Uncheck it
    fireEvent.click(sideCheckbox);
    expect(sideCheckbox).not.toBeChecked();

    // On single-line receipt, this writes autoGenerateArticles: false to storage
    const saved = JSON.parse(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}');
    expect(saved.autoGenerateArticles).toBe(false);

    // Close and reopen
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Even though qty = 2, stored false wins over quantity rule
    const reopenedSideCheckbox = getSideCheckbox();
    expect(reopenedSideCheckbox).not.toBeChecked();
  });

  it('warehouse change stores the pair and remembers location if valid in new warehouse', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [line(0, { productName: 'Item A', quantity: 1, price: 100 })],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    const warehouseSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement;
    const locationSelect = screen.getByLabelText('Location') as HTMLSelectElement;

    // Change location to loc-1-2
    fireEvent.change(locationSelect, { target: { value: 'loc-1-2' } });

    let saved = JSON.parse(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}');
    expect(saved).toEqual({ locationId: 'loc-1-2' });

    // Change warehouse to wh-2 (which only has loc-2-1, not loc-1-2)
    fireEvent.change(warehouseSelect, { target: { value: 'wh-2' } });

    saved = JSON.parse(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}');
    expect(saved).toEqual({ warehouseId: 'wh-2', locationId: 'loc-2-1' });

    // Change warehouse to wh-empty (no locations)
    fireEvent.change(warehouseSelect, { target: { value: 'wh-empty' } });

    saved = JSON.parse(window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY) ?? '{}');
    expect(saved).toEqual({ warehouseId: 'wh-empty', locationId: '' });

    // Close and reopen
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    const reopenedWhSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement;
    const reopenedLocSelect = screen.getByLabelText('Location') as HTMLSelectElement;
    expect(reopenedWhSelect.value).toBe('wh-empty');
    expect(reopenedLocSelect.value).toBe('');
  });

  it('a missing warehouse id falls back to first active warehouse and leaves storage unchanged', () => {
    window.localStorage.setItem(
      STOCK_RECEIPT_STORAGE_KEY,
      JSON.stringify({ warehouseId: 'wh-deleted', locationId: 'loc-deleted' }),
    );

    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [line(0, { productName: 'Item A', quantity: 1, price: 100 })],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    const warehouseSelect = screen.getByLabelText('Warehouse') as HTMLSelectElement;
    const locationSelect = screen.getByLabelText('Location') as HTMLSelectElement;

    // Falls back to first active warehouse and its first location
    expect(warehouseSelect.value).toBe('wh-1');
    expect(locationSelect.value).toBe('loc-1-1');

    // Storage is NOT rewritten on fallback
    const rawStorage = window.localStorage.getItem(STOCK_RECEIPT_STORAGE_KEY);
    expect(JSON.parse(rawStorage ?? '{}')).toEqual({
      warehouseId: 'wh-deleted',
      locationId: 'loc-deleted',
    });
  });

  it('article text and manual serials are blank on the next open', () => {
    renderModal(
      <SupplierOrderModal
        {...baseProps()}
        warehouseOptions={multiWarehouseOptions}
        onTakeOnCharge={vi.fn()}
        editingOrder={editingOrder({
          items: [line(0, { productName: 'Item A', quantity: 1, price: 100 })],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Uncheck auto serial to display manual serial input
    fireEvent.click(screen.getByLabelText('Auto-generate serial numbers'));

    const serialInput = screen.getByPlaceholderText('Serial number');
    fireEvent.change(serialInput, { target: { value: 'SN-ABC-999' } });
    expect(serialInput).toHaveValue('SN-ABC-999');

    // Single item article input placeholder
    const articleInput = screen.getByPlaceholderText('Example: SSD-KINGSTON');
    fireEvent.change(articleInput, { target: { value: 'ART-MANUAL-1' } });
    expect(articleInput).toHaveValue('ART-MANUAL-1');

    // Close and reopen
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Receive to stock' }));

    // Reopened dialog (auto-serial is stored false, so manual input appears again)
    const reopenedSerialInput = screen.getByPlaceholderText('Serial number');
    expect(reopenedSerialInput).toHaveValue('');

    const reopenedArticleInput = screen.getByPlaceholderText('Example: SSD-KINGSTON');
    expect(reopenedArticleInput).toHaveValue('');
  });
});

