import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { ReceiptRow, StockColumnKey } from '../model/warehouse-panel';
import { ReceiptsTable, StockTable } from './WarehouseTables';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const receipt: ReceiptRow = {
  id: 'receipt-1',
  number: 'SO-1',
  supplierOrderId: 'so-1',
  supplierOrderItemIndex: 0,
  catalogProductId: 'cat-1',
  productName: 'USB hub',
  quantity: 1,
  price: 100,
  amount: 100,
  paid: 0,
  supplierName: 'Parts Hub',
  createdAt: '2026-06-01T09:00:00.000Z',
  acceptedBy: 'Owner',
  approvedBy: 'Owner',
  acceptedAt: '2026-06-01T09:00:00.000Z',
  status: 'new',
  paymentStatus: 'pending',
  supplierOrderIsFavorite: false,
  note: '',
};

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

const stockTableProps = {
  products: [product],
  isLoading: false,
  visibleColumns: ['name', 'serial', 'article'] as StockColumnKey[],
  selectedProductIds: [],
  warehouses: [],
  serviceCenters: [],
  salesByProductId: {},
  supplierOrdersByProductId: {},
  productWarehouseMetaById: {},
  onToggleProductSelection: vi.fn(),
  onTogglePageSelection: vi.fn(),
  onEdit: vi.fn(),
  onOpenModel: vi.fn(),
  onOpenSerial: vi.fn(),
  onDelete: vi.fn(),
  onOpenSupplierOrder: vi.fn(),
};

describe('ReceiptsTable favorites', () => {
  it('calls the favorite handler for linked supplier-order receipts', () => {
    const onToggleFavorite = vi.fn();
    render(
      <ReceiptsTable
        receipts={[receipt]}
        visibleColumns={['number', 'product']}
        canManageSupplierOrders={true}
        onToggleFavorite={onToggleFavorite}
        onOpenOrder={vi.fn()}
        onOpenProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Star SO-1' }));

    expect(onToggleFavorite).toHaveBeenCalledWith(receipt);
  });

  it('does not render a star button for manual receipt rows', () => {
    render(
      <ReceiptsTable
        receipts={[
          {
            ...receipt,
            id: 'manual-1',
            number: 'R-1',
            supplierOrderId: undefined,
            supplierOrderIsFavorite: undefined,
          },
        ]}
        visibleColumns={['number']}
        canManageSupplierOrders={true}
        onToggleFavorite={vi.fn()}
        onOpenOrder={vi.fn()}
        onOpenProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Star R-1' })).not.toBeInTheDocument();
  });
});

describe('StockTable selectable links', () => {
  it('renders name, serial, and article as selectable action links', () => {
    const { container } = render(<StockTable {...stockTableProps} />);

    expect(screen.getByText('iPhone 15')).toBeInTheDocument();
    expect(screen.getByText('SN-12345')).toBeInTheDocument();
    expect(screen.getByText('ART-001')).toBeInTheDocument();
    expect(container.querySelectorAll('button.settings-link-button')).toHaveLength(0);
    expect(container.querySelectorAll('span.settings-link-button[role="button"]')).toHaveLength(3);
  });

  it('opens model and serial cards on click without text selection', () => {
    const onOpenModel = vi.fn();
    const onOpenSerial = vi.fn();
    render(
      <StockTable
        {...stockTableProps}
        onOpenModel={onOpenModel}
        onOpenSerial={onOpenSerial}
      />,
    );

    fireEvent.click(screen.getByText('iPhone 15'));
    fireEvent.click(screen.getByText('SN-12345'));
    fireEvent.click(screen.getByText('ART-001'));

    expect(onOpenModel).toHaveBeenCalledTimes(2);
    expect(onOpenModel).toHaveBeenCalledWith(product);
    expect(onOpenSerial).toHaveBeenCalledTimes(1);
    expect(onOpenSerial).toHaveBeenCalledWith(product);
  });

  it('does not trigger actions when text is selected', () => {
    const onOpenModel = vi.fn();
    const onOpenSerial = vi.fn();
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'SN-12345',
    } as Selection);

    render(
      <StockTable
        {...stockTableProps}
        onOpenModel={onOpenModel}
        onOpenSerial={onOpenSerial}
      />,
    );

    fireEvent.click(screen.getByText('iPhone 15'));
    fireEvent.click(screen.getByText('SN-12345'));
    fireEvent.click(screen.getByText('ART-001'));

    expect(onOpenModel).not.toHaveBeenCalled();
    expect(onOpenSerial).not.toHaveBeenCalled();
  });
});