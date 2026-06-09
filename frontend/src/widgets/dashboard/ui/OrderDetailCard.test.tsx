import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { OrderDetailCard } from './OrderDetailCard';
import type { OrderLineItem, OrderStatus } from './orders-workspace-shared';

vi.mock('../../../entities/product/api/productApi', () => ({
  getProducts: vi.fn(async () => []),
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
  onAddLineItem = vi.fn(),
  onError = vi.fn(),
  canAddComment = true,
  isReadOnly = false,
  saleOverride,
  status,
  lineItems = [],
}: {
  products?: Product[];
  catalogProducts?: CatalogProduct[];
  onAddLineItem?: (item: Omit<OrderLineItem, 'id'>) => void;
  onError?: (message: string) => void;
  canAddComment?: boolean;
  isReadOnly?: boolean;
  saleOverride?: Partial<Sale>;
  status?: OrderStatus;
  lineItems?: OrderLineItem[];
} = {}) => {
  const cardSale = sale(saleOverride);
  const cardStatus = status ?? (cardSale.status as OrderStatus);
  render(
    <OrderDetailCard
      sale={cardSale}
      sales={[cardSale]}
      supplierOrders={[]}
      employees={[]}
      status={cardStatus}
      statusOptions={[{ key: cardStatus, label: 'Test status' }]}
      comments={[]}
      lineItems={lineItems}
      products={products}
      catalogProducts={catalogProducts}
      paidAmount={0}
      isReadOnly={isReadOnly}
      canAddComment={canAddComment}
      canAcceptPayment={true}
      canRefundPayment={true}
      onClose={vi.fn()}
      onAddComment={vi.fn()}
      onAddLineItem={onAddLineItem}
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
      onUpdateProductModel={vi.fn(async () => true)}
      onError={onError}
      onSuccess={vi.fn()}
      onSaveMainInfo={vi.fn(async () => undefined)}
    />,
  );
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
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

    expect(screen.getByPlaceholderText('Add product')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add product' })).not.toBeDisabled();
  });

  it('disables live feed composer without orders.chat permission', () => {
    renderCard({ canAddComment: false });

    expect(screen.getByPlaceholderText('Comment')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
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
        onUpdateProductModel={vi.fn(async () => true)}
        onError={vi.fn()}
        onSuccess={vi.fn()}
        onSaveMainInfo={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByPlaceholderText('Comment')).toBeDisabled();
    expect(screen.getByLabelText('Repair status')).not.toBeDisabled();
  });
});
