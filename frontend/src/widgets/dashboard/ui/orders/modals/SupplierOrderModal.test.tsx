import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Supplier } from '../../../../../entities/supplier/model/types';
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
  getCatalogProductsMock: vi.fn(async () => []),
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

const baseProps = () => ({
  isOpen: true,
  suppliers: [supplier()],
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

    const basketRow = container.querySelector(
      '.supplier-order-basket-row',
    ) as HTMLElement;

    expect(basketRow.querySelectorAll('.number-stepper')).toHaveLength(2);

    const qtyInput = getStepperInput(basketRow, 'Qty');

    clickStepperIncrement(qtyInput);

    expect(qtyInput).toHaveValue('4');
  });

  it('shows amount label for computed line total', () => {
    renderModal(<SupplierOrderModal {...baseProps()} />);

    expect(screen.getByText('Amount')).toBeInTheDocument();
  });
});