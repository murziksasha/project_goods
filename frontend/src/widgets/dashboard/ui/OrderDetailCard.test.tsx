import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { ClientDevice } from '../../../entities/client-device/model/types';
import { getClientDevices } from '../../../entities/client-device/api/clientDeviceApi';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { getProducts } from '../../../entities/product/api/productApi';
import { getWarehouseSettings } from '../../../entities/warehouse-settings/api/warehouseSettingsApi';
import { OrderDetailCard } from './OrderDetailCard';
import {
  orderDetailSectionsStorageKey,
  type OrderLineItem,
  type OrderStatus,
} from './orders-workspace-shared';

vi.mock('../../../entities/product/api/productApi', () => ({
  getProducts: vi.fn(async () => []),
}));

vi.mock('../../../entities/client-device/api/clientDeviceApi', () => ({
  getClientDevices: vi.fn(async () => []),
}));

vi.mock('../../../entities/service-catalog/api/serviceCatalogApi', () => ({
  createServiceCatalogItem: vi.fn(),
  getServiceCatalogItems: vi.fn(async () => []),
}));

vi.mock('../../../entities/supplier-order/api/supplierOrderApi', () => ({
  cancelSupplierOrder: vi.fn(),
  createSupplierOrder: vi.fn(),
  takeOnChargeSupplierOrder: vi.fn(),
  updateSupplierOrder: vi.fn(),
}));

vi.mock('../../../entities/warehouse-settings/api/warehouseSettingsApi', () => ({
  getWarehouseSettings: vi.fn(async () => ({ warehouses: [] })),
}));

vi.mock('../../../entities/supplier/api/supplierApi', () => ({
  createSupplier: vi.fn(),
  getSuppliers: vi.fn(async () => []),
}));

const now = '2026-06-09T09:00:00.000Z';

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'product-1',
  name: 'TerraE 30E INR18650 2900mAh',
  article: 'A000001',
  serialNumber: 'S000003',
  price: 70,
  salePriceOptions: [88],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  purchaseDate: now,
  warrantyPeriod: 6,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const catalogProduct = (
  patch: Partial<CatalogProduct> = {},
): CatalogProduct => ({
  id: 'catalog-1',
  name: 'TerraE 30E INR18650 2900mAh',
  note: 'Battery model',
  isActive: true,
  usageCount: 0,
  sourceTags: [],
  lastSeenAt: now,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const clientDevice = (
  patch: Partial<ClientDevice> = {},
): ClientDevice => ({
  id: 'client-device-1',
  clientId: 'client-1',
  clientName: 'Client',
  clientPhone: '+380000000000',
  name: 'Coffee machine RZTK',
  serialNumber: '',
  note: '',
  source: 'repairOrder',
  isActive: true,
  canRemove: true,
  usageCount: 0,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const sale = (patch: Partial<Sale> = {}): Sale => ({
  id: 'sale-1',
  recordNumber: 'R000001',
  saleDate: now,
  quantity: 1,
  salePrice: 0,
  kind: 'sale',
  status: 'new',
  paidAmount: 0,
  note: '',
  timeline: [],
  paymentHistory: [],
  lineItems: [],
  client: {
    id: 'client-1',
    name: 'Client',
    phone: '+380000000000',
    status: 'regular',
  },
  product: {
    id: '',
    article: '',
    name: '',
    serialNumber: '',
  },
  manager: {
    id: 'employee-1',
    name: 'Manager',
    role: 'manager',
  },
  master: null,
  issuedBy: null,
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const renderCard = ({
  products = [product()],
  catalogProducts = [catalogProduct()],
  clientDevices = [],
  onAddLineItem = vi.fn(),
  onReplaceLineItem = vi.fn(),
  onUpdateLineItem = vi.fn(),
  onRemoveLineItem = vi.fn(),
  onDiscountChange = vi.fn(),
  onCreateClientDevice = vi.fn(async () => true),
  onSaveMainInfo = vi.fn(async () => undefined),
  onError = vi.fn(),
  canAddComment = true,
  isReadOnly = false,
  comments = [],
  saleOverride,
  salesOverride,
  onOpenRelatedSale = vi.fn(),
  status,
  lineItems = [],
}: {
  products?: Product[];
  catalogProducts?: CatalogProduct[];
  clientDevices?: ClientDevice[];
  onAddLineItem?: (item: Omit<OrderLineItem, 'id'>) => void;
  onReplaceLineItem?: (
    itemId: string,
    itemIndex: number | undefined,
    nextItems: Omit<OrderLineItem, 'id'>[],
  ) => void;
  onUpdateLineItem?: (
    itemId: string,
    itemIndex: number | undefined,
    patch: Partial<
      Pick<
        OrderLineItem,
        | 'name'
        | 'productId'
        | 'serviceId'
        | 'price'
        | 'quantity'
        | 'warrantyPeriod'
        | 'serialNumbers'
      >
    >,
  ) => void;
  onRemoveLineItem?: (itemId: string, itemIndex?: number) => void;
  onDiscountChange?: (discount: {
    mode: 'percent' | 'amount';
    value: number;
  }) => void;
  onCreateClientDevice?: Parameters<typeof OrderDetailCard>[0]['onCreateClientDevice'];
  onSaveMainInfo?: Parameters<typeof OrderDetailCard>[0]['onSaveMainInfo'];
  onError?: (message: string) => void;
  canAddComment?: boolean;
  isReadOnly?: boolean;
  comments?: Array<{
    id: string;
    kind?: 'manual' | 'system';
    author: string;
    message: string;
    createdAt: string;
  }>;
  saleOverride?: Partial<Sale>;
  salesOverride?: Sale[];
  onOpenRelatedSale?: (sale: Sale) => void;
  status?: OrderStatus;
  lineItems?: OrderLineItem[];
} = {}) => {
  const cardSale = sale(saleOverride);
  const cardStatus = status ?? (cardSale.status as OrderStatus);
  const result = render(
    <OrderDetailCard
      sale={cardSale}
      sales={salesOverride ?? [cardSale]}
      supplierOrders={[]}
      employees={[]}
      status={cardStatus}
      statusOptions={[{ key: cardStatus, label: 'Test status' }]}
      comments={comments}
      lineItems={lineItems}
      products={products}
      clientDevices={clientDevices}
      catalogProducts={catalogProducts}
      paidAmount={0}
      isReadOnly={isReadOnly}
      canAddComment={canAddComment}
      canAcceptPayment={true}
      canRefundPayment={true}
      onClose={vi.fn()}
      onAddComment={vi.fn()}
      onAddLineItem={onAddLineItem}
      onReplaceLineItem={onReplaceLineItem}
      onRemoveLineItem={onRemoveLineItem}
      onUpdateLineItem={onUpdateLineItem}
      onReturnLineItem={vi.fn()}
      onOpenRelatedSale={onOpenRelatedSale}
      onAcceptPayment={vi.fn()}
      onOpenPrint={vi.fn()}
      onRefundPayment={vi.fn()}
      onDiscountChange={onDiscountChange}
      onOpenClientCard={vi.fn()}
      onSupplierOrderCreated={vi.fn(async () => undefined)}
      onCreateClientDevice={onCreateClientDevice}
      onUpdateProductModel={vi.fn(async () => true)}
      onError={onError}
      onSuccess={vi.fn()}
      onSaveMainInfo={onSaveMainInfo}
    />,
  );
  return { ...result, onCreateClientDevice, onOpenRelatedSale, onSaveMainInfo };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(getClientDevices).mockResolvedValue([]);
  window.localStorage.clear();
});

describe('OrderDetailCard repair device replacement', () => {
  const repairSale: Partial<Sale> = {
    kind: 'repair',
    status: 'new',
    product: {
      id: 'device-snapshot',
      article: '',
      name: 'Old device',
      serialNumber: 'SN-OLD',
    },
  };

  it('shows the device change action only for repair orders', () => {
    renderCard({ saleOverride: repairSale });

    expect(screen.getByLabelText('Change device')).toBeInTheDocument();

    cleanup();
    renderCard();

    expect(screen.queryByLabelText('Change device')).not.toBeInTheDocument();
  });

  it('lists only active devices for the current client', () => {
    renderCard({
      saleOverride: repairSale,
      clientDevices: [
        clientDevice({ id: 'active-1', name: 'Espresso machine' }),
        clientDevice({ id: 'inactive-1', name: 'Inactive grinder', isActive: false }),
        clientDevice({ id: 'other-client', clientId: 'client-2', name: 'Other client phone' }),
      ],
    });

    fireEvent.click(screen.getByLabelText('Change device'));

    expect(screen.getByText('Espresso machine')).toBeInTheDocument();
    expect(screen.queryByText('Inactive grinder')).not.toBeInTheDocument();
    expect(screen.queryByText('Other client phone')).not.toBeInTheDocument();
  });

  it('finds active devices through the same lookup used by create order', async () => {
    const lookupDevice = clientDevice({
      id: 'lookup-device',
      clientId: 'another-client',
      name: 'Lookup RZTK coffee machine',
    });
    vi.mocked(getClientDevices).mockImplementation(async (query = '') =>
      query.trim().length >= 2 ? [lookupDevice] : [],
    );
    renderCard({
      saleOverride: repairSale,
      clientDevices: [],
    });

    fireEvent.click(screen.getByLabelText('Change device'));
    fireEvent.change(screen.getByPlaceholderText('Search client devices'), {
      target: { value: 'Lookup RZTK coffee machine' },
    });

    await waitFor(() => {
      expect(getClientDevices).toHaveBeenCalledWith(
        'Lookup RZTK coffee machine',
      );
    });
    expect(
      await screen.findByRole('button', {
        name: /Lookup RZTK coffee machine/,
      }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('selects an existing client device and saves it as order main info', async () => {
    const onSaveMainInfo = vi.fn(async () => undefined);
    renderCard({
      saleOverride: repairSale,
      clientDevices: [clientDevice({ id: 'device-new', name: 'New client laptop' })],
      onSaveMainInfo,
    });

    fireEvent.click(screen.getByLabelText('Change device'));
    fireEvent.click(screen.getByRole('button', { name: /New client laptop/ }));
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => {
      expect(onSaveMainInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceName: 'New client laptop',
          serialNumber: 'SN-OLD',
        }),
      );
    });
  });

  it('creates a new client device and applies it to the order draft', async () => {
    const onCreateClientDevice = vi.fn(async () => true);
    const onSaveMainInfo = vi.fn(async () => undefined);
    renderCard({
      saleOverride: repairSale,
      onCreateClientDevice,
      onSaveMainInfo,
    });

    fireEvent.click(screen.getByLabelText('Change device'));
    fireEvent.change(screen.getByPlaceholderText('Device name'), {
      target: { value: 'Brand new kettle' },
    });
    fireEvent.click(screen.getByText('Create and apply'));
    fireEvent.click(await screen.findByText('Save changes'));

    expect(onCreateClientDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'client-1',
        clientName: 'Client',
        clientPhone: '+380000000000',
        name: 'Brand new kettle',
        serialNumber: '',
        source: 'repairOrder',
        isActive: true,
      }),
    );
    expect(onSaveMainInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceName: 'Brand new kettle',
        serialNumber: 'SN-OLD',
      }),
    );
  });

  it('clears order serial only when the modal checkbox is enabled', async () => {
    const onSaveMainInfo = vi.fn(async () => undefined);
    renderCard({
      saleOverride: repairSale,
      clientDevices: [clientDevice({ id: 'device-new', name: 'Replacement tablet' })],
      onSaveMainInfo,
    });

    fireEvent.click(screen.getByLabelText('Change device'));
    fireEvent.click(screen.getByLabelText('Clear S/N for this order'));
    fireEvent.click(screen.getByRole('button', { name: /Replacement tablet/ }));
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => {
      expect(onSaveMainInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceName: 'Replacement tablet',
          serialNumber: '',
        }),
      );
    });
  });

  it('renders long device names inside the change control', () => {
    renderCard({
      saleOverride: {
        ...repairSale,
        product: {
          id: 'long-device',
          article: '',
          name: 'Very long customer device name with additional model details and color',
          serialNumber: '',
        },
      },
    });

    expect(screen.getByLabelText('Change device')).toHaveTextContent(
      'Very long customer device name with additional model details and color',
    );
  });
});

describe('OrderDetailCard product entry', () => {
  it('adds a catalog Product List item as a quantity line without serials', async () => {
    const onAddLineItem = vi.fn();
    const onError = vi.fn();
    renderCard({ onAddLineItem, onError });

    fireEvent.change(screen.getByPlaceholderText('Add product'), {
      target: { value: 'TerraE' },
    });
    await waitFor(() => {
      expect(screen.getByText(/Product List/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('TerraE 30E INR18650 2900mAh'));
    fireEvent.change(screen.getByPlaceholderText('Qty'), {
      target: { value: '4' },
    });
    fireEvent.click(screen.getByText('Add product'));

    expect(onError).not.toHaveBeenCalledWith(
      expect.stringContaining('one serial per line'),
    );
    expect(onAddLineItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'product',
        catalogProductId: 'catalog-1',
        productId: undefined,
        name: 'TerraE 30E INR18650 2900mAh',
        price: 88,
        quantity: 4,
        warrantyPeriod: 6,
        serialNumbers: undefined,
      }),
    );
  });

  it('keeps exact serial selection as an atomic stock shortcut', async () => {
    const onAddLineItem = vi.fn();
    renderCard({ catalogProducts: [], onAddLineItem });

    fireEvent.change(screen.getByPlaceholderText('Add product'), {
      target: { value: 'S000003' },
    });
    await waitFor(() => {
      expect(screen.getByText('TerraE 30E INR18650 2900mAh')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('TerraE 30E INR18650 2900mAh'));

    expect(onAddLineItem).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'product',
        productId: 'product-1',
        name: 'TerraE 30E INR18650 2900mAh',
        price: 88,
        quantity: 1,
        warrantyPeriod: 0,
        serialNumbers: ['S000003'],
      }),
    );
  });

  it('binds selected serials without showing the manual serial textarea', async () => {
    const onReplaceLineItem = vi.fn();
    const stockProducts = [
      product({ id: 'product-1', serialNumber: 'S000003' }),
      product({ id: 'product-2', serialNumber: 'S000004' }),
    ];
    vi.mocked(getProducts).mockResolvedValue(stockProducts);

    const { container } = renderCard({
      products: stockProducts,
      catalogProducts: [],
      onReplaceLineItem,
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          productId: undefined,
          name: 'TerraE 30E INR18650 2900mAh',
          price: 88,
          quantity: 2,
          warrantyPeriod: 6,
          serialNumbers: [],
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /Serials\s*0\/2/i }));

    expect(await screen.findByText('[ ] S000003')).toBeInTheDocument();
    expect(screen.getByText('[ ] S000004')).toBeInTheDocument();
    expect(container.querySelector('.serial-bind-modal textarea')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /\[ \] S000003/i }));
    fireEvent.click(screen.getByRole('button', { name: /\[ \] S000004/i }));
    expect(screen.getByText('Selected: 2')).toBeInTheDocument();

    const selectedRemoveButton = container.querySelector<HTMLButtonElement>(
      '.serial-bind-selected-item .line-item-remove-button',
    );
    expect(selectedRemoveButton).not.toBeNull();
    fireEvent.click(selectedRemoveButton!);
    expect(screen.getByText('Selected: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear selected' }));
    expect(screen.queryByText('Selected: 1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\[ \] S000004/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onReplaceLineItem).toHaveBeenCalledWith(
      'line-item-1',
      undefined,
      [
        expect.objectContaining({
          kind: 'product',
          productId: 'product-2',
          name: 'TerraE 30E INR18650 2900mAh',
          quantity: 1,
          serialNumbers: ['S000004'],
        }),
      ],
    );
  });

  it('keeps an existing product row when its price input is cleared', () => {
    const onUpdateLineItem = vi.fn();
    const onRemoveLineItem = vi.fn();
    renderCard({
      onUpdateLineItem,
      onRemoveLineItem,
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          name: 'Existing part',
          price: 650,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    const priceInput = screen.getByDisplayValue('650');
    fireEvent.change(priceInput, {
      target: { value: '' },
    });

    expect(priceInput).toHaveValue('');
    expect(onUpdateLineItem).not.toHaveBeenCalled();
    expect(onRemoveLineItem).not.toHaveBeenCalled();
  });

  it('updates existing product prices only from valid editable number states', () => {
    const onUpdateLineItem = vi.fn();
    renderCard({
      onUpdateLineItem,
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          name: 'Existing part',
          price: 650,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    const priceInput = screen.getByDisplayValue('650');
    fireEvent.change(priceInput, { target: { value: '0' } });
    fireEvent.change(priceInput, { target: { value: '1.3' } });
    fireEvent.change(priceInput, { target: { value: '1,3' } });

    expect(onUpdateLineItem).toHaveBeenNthCalledWith(1, 'line-item-1', undefined, {
      price: 0,
    });
    expect(onUpdateLineItem).toHaveBeenNthCalledWith(2, 'line-item-1', undefined, {
      price: 1.3,
    });
    expect(onUpdateLineItem).toHaveBeenNthCalledWith(3, 'line-item-1', undefined, {
      price: 1.3,
    });
  });

  it('shows bound product serials in a column before price without the S/N label', () => {
    renderCard({
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          name: 'Serialized part',
          price: 650,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['R0035752'],
        },
      ],
    });

    const serialHeader = screen.getByText('Serial number');
    const priceHeader = screen.getAllByText('Price')[0];
    expect(
      serialHeader.compareDocumentPosition(priceHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const serial = screen.getByText('R0035752');
    expect(serial.closest('.order-line-item-serial-cell')).not.toBeNull();
    expect(serial.closest('.order-line-item-price-cell')).toBeNull();
    expect(screen.getByDisplayValue('650').closest('.order-line-item-price-cell')).not.toBeNull();
    expect(screen.queryByText(/S\/N:/)).not.toBeInTheDocument();
  });

  it('opens the product model modal in serial mode when clicking a matching bound serial', async () => {
    renderCard({
      products: [
        product({
          id: 'serialized-product',
          name: 'Serialized part',
          serialNumber: 'R0035752',
        }),
      ],
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          productId: 'serialized-product',
          name: 'Serialized part',
          price: 650,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['R0035752'],
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'R0035752' }));

    expect(
      await screen.findByRole('dialog', { name: 'Product model' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Print serial number' }),
    ).toBeInTheDocument();
    expect(getWarehouseSettings).toHaveBeenCalled();
  });

  it('opens the product model modal without serial print mode from a product name click', async () => {
    renderCard({
      products: [
        product({
          id: 'product-model',
          name: 'Existing part',
          serialNumber: 'R0035752',
        }),
      ],
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          productId: 'product-model',
          name: 'Existing part',
          price: 650,
          quantity: 1,
          warrantyPeriod: 0,
          serialNumbers: ['R0035752'],
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Existing part' }));

    expect(
      await screen.findByRole('dialog', { name: 'Product model' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Print serial number' }),
    ).not.toBeInTheDocument();
  });

  it('keeps discount percent input editable while accepting comma and dot decimals', () => {
    const onDiscountChange = vi.fn();
    const { container } = renderCard({
      onDiscountChange,
      saleOverride: {
        discount: { mode: 'percent', value: 1 },
      },
    });
    const discountInput = container.querySelector<HTMLInputElement>(
      '.order-payment-discount-control input',
    );

    expect(discountInput).not.toBeNull();
    fireEvent.change(discountInput!, { target: { value: '1,' } });
    expect(discountInput).toHaveValue('1,');
    fireEvent.change(discountInput!, { target: { value: '1.3' } });
    fireEvent.change(discountInput!, { target: { value: '1,3' } });

    expect(onDiscountChange).toHaveBeenNthCalledWith(1, {
      mode: 'percent',
      value: 1,
    });
    expect(onDiscountChange).toHaveBeenNthCalledWith(2, {
      mode: 'percent',
      value: 1.3,
    });
    expect(onDiscountChange).toHaveBeenNthCalledWith(3, {
      mode: 'percent',
      value: 1.3,
    });
  });

  it('keeps repair products editable in client approved status', () => {
    renderCard({
      saleOverride: { kind: 'repair', status: 'clientApproved' },
      status: 'clientApproved',
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          name: 'Existing part',
          price: 10,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: /Products/i }));
    expect(screen.getByPlaceholderText('Add product')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add product' })).not.toBeDisabled();
  });

  it('keeps order card products collapsed by default even with existing product items', () => {
    renderCard({
      saleOverride: { kind: 'repair', status: 'clientApproved' },
      status: 'clientApproved',
      lineItems: [
        {
          id: 'line-item-1',
          kind: 'product',
          name: 'Existing part',
          price: 10,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Products/i }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByPlaceholderText('Add product')).not.toBeInTheDocument();
  });

  it('keeps sale card products open by default', () => {
    renderCard();

    expect(
      screen.getByRole('button', { name: /Products/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText('Add product')).toBeInTheDocument();
  });

  it('restores saved section state from localStorage', () => {
    window.localStorage.setItem(
      orderDetailSectionsStorageKey,
      JSON.stringify({
        'sale-1': {
          productsOpen: true,
          servicesOpen: false,
        },
      }),
    );

    renderCard({
      saleOverride: { kind: 'repair', status: 'clientApproved' },
      status: 'clientApproved',
    });

    expect(
      screen.getByRole('button', { name: /Products/i }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByPlaceholderText('Add product')).toBeInTheDocument();
  });

  it('disables live feed composer without orders.chat permission', () => {
    renderCard({ canAddComment: false });

    expect(screen.getByPlaceholderText('Comment')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('renders manual live feed comments with manual styling', () => {
    renderCard({
      comments: [
        {
          id: 'manual-comment',
          kind: 'manual',
          author: 'Manager',
          message: 'Manual note for client',
          createdAt: now,
        },
      ],
    });

    expect(screen.getByText('Manual note for client')).toHaveClass(
      'order-timeline-message-manual',
    );
  });

  it('keeps system live feed messages in system styling', () => {
    renderCard({
      comments: [
        {
          id: 'system-comment',
          kind: 'system',
          author: 'Manager',
          message: 'Manager added service "Diagnostics".',
          createdAt: now,
        },
      ],
    });

    expect(screen.getByText('Manager added service "Diagnostics".')).toHaveClass(
      'order-timeline-message-system',
    );
  });

  it('keeps repair card editable while still blocking comment add without orders.chat', () => {
    render(
      <OrderDetailCard
        sale={sale({ kind: 'repair' })}
        sales={[sale({ kind: 'repair' })]}
        supplierOrders={[]}
        employees={[]}
        status={'new' as OrderStatus}
        statusOptions={[{ key: 'new' as OrderStatus, label: 'New repair' }]}
        comments={[]}
        lineItems={[]}
        products={[product()]}
        clientDevices={[]}
        catalogProducts={[catalogProduct()]}
        paidAmount={0}
        isReadOnly={false}
        canAddComment={false}
        canAcceptPayment={true}
        canRefundPayment={true}
        onClose={vi.fn()}
        onAddComment={vi.fn()}
        onAddLineItem={vi.fn()}
        onReplaceLineItem={vi.fn()}
        onRemoveLineItem={vi.fn()}
        onUpdateLineItem={vi.fn()}
        onReturnLineItem={vi.fn()}
        onOpenRelatedSale={vi.fn()}
        onAcceptPayment={vi.fn()}
        onOpenPrint={vi.fn()}
        onRefundPayment={vi.fn()}
        onDiscountChange={vi.fn()}
        onOpenClientCard={vi.fn()}
        onSupplierOrderCreated={vi.fn(async () => undefined)}
        onCreateClientDevice={vi.fn(async () => true)}
        onUpdateProductModel={vi.fn(async () => true)}
        onError={vi.fn()}
        onSuccess={vi.fn()}
        onSaveMainInfo={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByPlaceholderText('Comment')).toBeDisabled();
    expect(screen.getByLabelText('Repair status')).not.toBeDisabled();
  });

  it('renders related orders and sales as browser links while preserving plain left click handling', () => {
    const currentSale = sale({
      id: 'repair-1',
      recordNumber: 'R000001',
      kind: 'repair',
      status: 'new',
      product: {
        id: 'product-1',
        article: '',
        name: 'Main device',
        serialNumber: '',
      },
    });
    const relatedSale = sale({
      id: 'sale-2',
      recordNumber: 'S000002',
      kind: 'sale',
      product: null,
      lineItems: [
        {
          id: 'line-sale',
          kind: 'product',
          name: 'Related sale item',
          price: 120,
          quantity: 1,
          warrantyPeriod: 0,
        },
      ],
    });
    const onOpenRelatedSale = vi.fn();

    renderCard({
      saleOverride: currentSale,
      salesOverride: [currentSale, relatedSale],
      onOpenRelatedSale,
      status: 'new',
    });

    const orderLink = screen.getByRole('link', { name: /r000001/i });
    expect(orderLink).toHaveAttribute(
      'href',
      '/?page=orders&ordersTab=orders&saleId=repair-1',
    );
    fireEvent.click(orderLink);
    expect(onOpenRelatedSale).toHaveBeenCalledWith(currentSale);

    fireEvent.click(screen.getByRole('button', { name: 'Sales' }));
    const saleLink = screen.getByRole('link', { name: /s000002/i });
    expect(saleLink).toHaveAttribute(
      'href',
      '/?page=orders&ordersTab=sales&saleId=sale-2',
    );
  });
});
