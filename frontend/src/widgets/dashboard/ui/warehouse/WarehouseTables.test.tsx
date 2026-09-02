import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clipboard from '../../../../shared/lib/clipboard';
import type { Product } from '../../../../entities/product/model/types';
import {
  getWarehouseStockTableMinWidth,
  warehouseStockNameWidthDefault,
  warehouseStockNameWidthStorageKey,
  type ReceiptRow,
  type StockColumnKey,
} from '../../model/warehouse-panel';
import { ReceiptsTable, StockTable } from './WarehouseTables';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
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
  view: 'units' as const,
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
  onToggleGroupSelection: vi.fn(),
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
        view='lines'
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
        view='lines'
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

  it('copies the receipt number without opening the order', async () => {
    const onOpenOrder = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <ReceiptsTable
        receipts={[receipt]}
        view='lines'
        visibleColumns={['number', 'product']}
        canManageSupplierOrders={true}
        onToggleFavorite={vi.fn()}
        onOpenOrder={onOpenOrder}
        onOpenProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SO-1');
    });
    expect(onOpenOrder).not.toHaveBeenCalled();
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

  it('copies name and serial from the hover icon without opening cards', async () => {
    const onOpenModel = vi.fn();
    const onOpenSerial = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    render(
      <StockTable
        {...stockTableProps}
        onOpenModel={onOpenModel}
        onOpenSerial={onOpenSerial}
      />,
    );

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    expect(copyButtons).toHaveLength(2);

    fireEvent.click(copyButtons[0]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('iPhone 15');
    });

    fireEvent.click(copyButtons[1]);
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SN-12345');
    });
    expect(onOpenModel).not.toHaveBeenCalled();
    expect(onOpenSerial).not.toHaveBeenCalled();
  });
});

describe('StockTable models view', () => {
  it('groups matching products and expands serials', () => {
    const second: Product = {
      ...product,
      id: 'product-2',
      serialNumber: 'SN-99999',
    };
    const onToggleGroupSelection = vi.fn();
    render(
      <StockTable
        {...stockTableProps}
        products={[product, second]}
        groups={[
          {
            id: 'iphone-15::art-001',
            name: 'iPhone 15',
            article: 'ART-001',
            products: [product, second],
          },
        ]}
        view='models'
        visibleColumns={['select', 'name', 'serial']}
        onToggleGroupSelection={onToggleGroupSelection}
      />,
    );

    expect(screen.getAllByText('iPhone 15')).toHaveLength(1);
    expect(screen.queryByText('SN-12345')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Show serials for iPhone 15' }),
    );

    expect(screen.getByText('SN-12345')).toBeInTheDocument();
    expect(screen.getByText('SN-99999')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Select all units of iPhone 15' }),
    );
    expect(onToggleGroupSelection).toHaveBeenCalledWith([
      'product-1',
      'product-2',
    ]);
  });

  it('resizes the name column from the header handle', () => {
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();

    const { container } = render(
      <StockTable {...stockTableProps} visibleColumns={['name']} />,
    );
    const handle = screen.getByRole('separator', {
      name: 'Resize name column',
    });
    const table = container.querySelector(
      '.warehouse-stock-table',
    ) as HTMLElement;

    fireEvent.pointerDown(handle, { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 420, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(table.style.getPropertyValue('--warehouse-name-col-width')).toBe(
      '440px',
    );
    expect(
      window.localStorage.getItem(warehouseStockNameWidthStorageKey),
    ).toBe('440');
  });

  it('restores the name column width from this device on remount', () => {
    window.localStorage.setItem(warehouseStockNameWidthStorageKey, '512');

    const firstRender = render(
      <StockTable {...stockTableProps} visibleColumns={['name']} />,
    );
    const firstTable = firstRender.container.querySelector(
      '.warehouse-stock-table',
    ) as HTMLElement;
    expect(firstTable.style.getPropertyValue('--warehouse-name-col-width')).toBe(
      '512px',
    );
    firstRender.unmount();

    const secondRender = render(
      <StockTable {...stockTableProps} visibleColumns={['name']} />,
    );
    const secondTable = secondRender.container.querySelector(
      '.warehouse-stock-table',
    ) as HTMLElement;
    expect(
      secondTable.style.getPropertyValue('--warehouse-name-col-width'),
    ).toBe('512px');
  });

  it('sets a table min-width that fits supplier order and supplier headers', () => {
    const visibleColumns: StockColumnKey[] = [
      'select',
      'name',
      'serial',
      'article',
      'date',
      'purchase',
      'warehouse',
      'clientOrder',
      'supplierOrder',
      'supplier',
      'note',
      'action',
    ];
    const { container } = render(
      <StockTable {...stockTableProps} visibleColumns={visibleColumns} />,
    );
    const table = container.querySelector(
      '.warehouse-stock-table',
    ) as HTMLElement;

    expect(table.style.minWidth).toBe(
      `max(100%, ${getWarehouseStockTableMinWidth(
        visibleColumns,
        warehouseStockNameWidthDefault,
      )}px)`,
    );
    expect(
      container.querySelector('th.warehouse-stock-cell-supplierOrder'),
    ).toHaveTextContent('Supplier order');
    expect(
      container.querySelector('th.warehouse-stock-cell-supplier'),
    ).toHaveTextContent('Supplier');
  });
});

describe('ReceiptsTable orders view', () => {
  it('groups line items from the same supplier order', () => {
    const second: ReceiptRow = {
      ...receipt,
      id: 'receipt-2',
      productName: 'HDMI cable',
      quantity: 3,
      amount: 300,
    };
    render(
      <ReceiptsTable
        receipts={[receipt, second]}
        groups={[
          {
            id: 'so-1',
            number: 'SO-1',
            receipts: [receipt, second],
          },
        ]}
        view='orders'
        visibleColumns={['number', 'product', 'price', 'amount']}
        canManageSupplierOrders={true}
        onToggleFavorite={vi.fn()}
        onOpenOrder={vi.fn()}
        onOpenProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
      />,
    );

    expect(screen.getByText('USB hub')).toBeInTheDocument();
    expect(screen.queryByText('HDMI cable')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.queryByText('Paid / Amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Quantity')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Show lines for SO-1' }),
    );

    expect(screen.getByText('HDMI cable')).toBeInTheDocument();
  });
});