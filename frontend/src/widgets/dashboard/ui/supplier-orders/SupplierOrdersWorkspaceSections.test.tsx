import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogProduct } from '../../../../entities/catalog-product/model/types';
import type { Supplier } from '../../../../entities/supplier/model/types';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import type { SupplierOrdersColumnKey } from '../../model/supplier-orders-workspace';
import * as clipboard from '../../../../shared/lib/clipboard';
import { SupplierOrdersTable } from './SupplierOrdersWorkspaceSections';

const catalogProduct: CatalogProduct = {
  id: 'cat-1',
  name: 'Type C cable',
  note: '',
  isActive: true,
  sourceTags: [],
  lastSeenAt: '2026-05-19T00:00:00.000Z',
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

const supplier: Supplier = {
  id: 'sup-1',
  name: 'Parts Hub',
  phone: '+380501111111',
  phones: ['+380501111111'],
  supplierOrder: '',
  note: '',
  isActive: true,
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
};

const copyButtonFor = (text: string) =>
  within(
    screen.getByText(text).closest('.copyable-value') as HTMLElement,
  ).getByRole('button', { name: 'Copy' });

const makeOrder = (patch: Partial<SupplierOrder> = {}): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1',
  supplierId: 'sup-1',
  supplierName: 'Parts Hub',
  deliveryDate: '2026-05-19T10:00:00.000Z',
  supplyType: 'local',
  number: 'SO-1',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 500,
  paid: 100,
  isFavorite: false,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Type C cable',
      quantity: 5,
      price: 100,
    },
  ],
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
  ...patch,
});

const renderTable = ({
  order = makeOrder(),
  expandedOrderIds = new Set<string>(),
  catalogProducts = [] as CatalogProduct[],
  suppliers = [] as Supplier[],
  visibleColumns = [
    'number',
    'product',
    'status',
    'paymentStatus',
  ] as SupplierOrdersColumnKey[],
  onToggleFavorite = vi.fn(),
  onEditOrder = vi.fn(),
  onToggleOrderExpanded = vi.fn(),
  onOpenCatalogProduct = vi.fn(),
  onOpenSupplier = vi.fn(),
}: {
  order?: SupplierOrder;
  expandedOrderIds?: Set<string>;
  catalogProducts?: CatalogProduct[];
  suppliers?: Supplier[];
  visibleColumns?: SupplierOrdersColumnKey[];
  onToggleFavorite?: (order: SupplierOrder) => void;
  onEditOrder?: (
    order: SupplierOrder,
    sourceOrder: SupplierOrder,
    itemIndex: number | null,
  ) => void;
  onToggleOrderExpanded?: (orderId: string) => void;
  onOpenCatalogProduct?: (product: CatalogProduct) => void;
  onOpenSupplier?: (nextSupplier: Supplier) => void;
} = {}) => {
  render(
    <SupplierOrdersTable
      catalogProducts={catalogProducts}
      expandedOrderIds={expandedOrderIds}
      filteredOrdersCount={1}
      totals={{
        orderCount: 1,
        pcs: 5,
        total: 500,
        paid: 100,
        outstanding: 400,
      }}
      isLoading={false}
      openStatusOrder={null}
      page={1}
      pageSize={30}
      paginatedOrders={[order]}
      suppliers={suppliers}
      visibleColumns={visibleColumns}
      canViewSupplierOrders
      canManageSupplierOrders
      onError={vi.fn()}
      onEditOrder={onEditOrder}
      onOpenCatalogProduct={onOpenCatalogProduct}
      onOpenSupplier={onOpenSupplier}
      onToggleFavorite={onToggleFavorite}
      onToggleOrderExpanded={onToggleOrderExpanded}
      onOpenStatusOrder={vi.fn()}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />,
  );
};

describe('SupplierOrdersTable', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders active and inactive star state', () => {
    renderTable({ order: makeOrder({ isFavorite: true }) });

    expect(screen.getByLabelText('Remove star from SO-1')).toHaveTextContent(
      '★',
    );
  });

  it('calls favorite toggle handler from row star', () => {
    const order = makeOrder();
    const onToggleFavorite = vi.fn();
    renderTable({ order, onToggleFavorite });

    fireEvent.click(screen.getByLabelText('Star SO-1'));

    expect(onToggleFavorite).toHaveBeenCalledWith(order);
  });

  it('opens (calls onEditOrder) for paid supplier order when read access present (read-only view)', () => {
    const onEdit = vi.fn();
    const onErr = vi.fn();
    const paidOrder = makeOrder({
      id: 'so-paid',
      paymentStatus: 'paid',
      number: 'SO-PAID',
    });
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
        expandedOrderIds={new Set()}
        filteredOrdersCount={1}
        totals={{
          orderCount: 1,
          pcs: 1,
          total: 500,
          paid: 100,
          outstanding: 400,
        }}
        isLoading={false}
        openStatusOrder={null}
        page={1}
        pageSize={30}
        paginatedOrders={[paidOrder]}
        suppliers={[]}
        visibleColumns={['number']}
        canViewSupplierOrders
        canManageSupplierOrders={false}
        onError={onErr}
        onEditOrder={onEdit}
        onOpenCatalogProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOrderExpanded={vi.fn()}
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SO-PAID'));

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        number: 'SO-PAID',
        items: [paidOrder.items[0]],
      }),
      paidOrder,
      0,
    );
    expect(onErr).not.toHaveBeenCalled();
  });

  it('opens (calls onEditOrder) for stocked supplier order (read-only after receipt)', () => {
    const onEdit = vi.fn();
    const stockedOrder = makeOrder({
      id: 'so-stocked',
      status: 'stocked',
      number: 'SO-STK',
    });
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
        expandedOrderIds={new Set()}
        filteredOrdersCount={1}
        totals={{
          orderCount: 1,
          pcs: 1,
          total: 500,
          paid: 100,
          outstanding: 400,
        }}
        isLoading={false}
        openStatusOrder={null}
        page={1}
        pageSize={30}
        paginatedOrders={[stockedOrder]}
        suppliers={[]}
        visibleColumns={['number']}
        canViewSupplierOrders
        canManageSupplierOrders
        onError={vi.fn()}
        onEditOrder={onEdit}
        onOpenCatalogProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOrderExpanded={vi.fn()}
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SO-STK'));
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        number: 'SO-STK',
        items: [stockedOrder.items[0]],
      }),
      stockedOrder,
      0,
    );
  });

  it('does not call onEditOrder and calls onError when no view permission', () => {
    const onEdit = vi.fn();
    const onErr = vi.fn();
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
        expandedOrderIds={new Set()}
        filteredOrdersCount={1}
        totals={{
          orderCount: 1,
          pcs: 1,
          total: 500,
          paid: 100,
          outstanding: 400,
        }}
        isLoading={false}
        openStatusOrder={null}
        page={1}
        pageSize={30}
        paginatedOrders={[makeOrder()]}
        suppliers={[]}
        visibleColumns={['number']}
        canViewSupplierOrders={false}
        canManageSupplierOrders={false}
        onError={onErr}
        onEditOrder={onEdit}
        onOpenCatalogProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOrderExpanded={vi.fn()}
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SO-1'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(onErr).toHaveBeenCalled();
  });

  it('renders collapsed parent row for multi-item orders', () => {
    const longNumber = 'SO-1779142808517';
    const order = makeOrder({
      id: 'so-multi',
      number: longNumber,
      orderBaseId: longNumber,
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          catalogProductId: 'cat-1',
          productName: 'Type C cable',
          quantity: 5,
          price: 100,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          catalogProductId: 'cat-2',
          productName: 'Router TP-Link',
          quantity: 2,
          price: 900,
        },
      ],
    });

    renderTable({ order });

    expect(screen.getByText(longNumber)).toBeInTheDocument();
    expect(screen.queryByText(`${longNumber}-1`)).not.toBeInTheDocument();
    expect(screen.queryByText(`${longNumber}-2`)).not.toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('renders child rows when multi-item order is expanded', () => {
    const longNumber = 'SO-1779142808517';
    const order = makeOrder({
      id: 'so-multi',
      number: longNumber,
      orderBaseId: longNumber,
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          catalogProductId: 'cat-1',
          productName: 'Type C cable',
          quantity: 5,
          price: 100,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          catalogProductId: 'cat-2',
          productName: 'Router TP-Link',
          quantity: 2,
          price: 900,
        },
      ],
    });

    renderTable({ order, expandedOrderIds: new Set(['so-multi']) });

    const childNumberButtons = document.querySelectorAll(
      '.supplier-order-group-child .supplier-order-number-button',
    );
    expect(childNumberButtons).toHaveLength(2);
    expect(childNumberButtons[0]).toHaveTextContent('1');
    expect(childNumberButtons[1]).toHaveTextContent('2');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('opens full-order modal from parent row and item modal from child row', async () => {
    const order = makeOrder({
      id: 'so-multi',
      number: 'SO-MULTI',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });
    const onEditOrder = vi.fn();

    renderTable({
      order,
      expandedOrderIds: new Set(['so-multi']),
      onEditOrder,
    });

    fireEvent.click(screen.getByText('SO-MULTI'));
    expect(onEditOrder).toHaveBeenCalledWith(order, order, null);

    onEditOrder.mockClear();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    fireEvent.click(copyButtonFor('SO-MULTI'));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('SO-MULTI');
    });
    expect(onEditOrder).not.toHaveBeenCalled();

    fireEvent.click(
      document.querySelector(
        '.supplier-order-group-child .supplier-order-number-button',
      ) as HTMLButtonElement,
    );
    expect(onEditOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        number: 'SO-MULTI-1',
        items: [order.items[0]],
      }),
      order,
      0,
    );
  });

  it('toggles expanded state from parent chevron', () => {
    const order = makeOrder({
      id: 'so-multi',
      number: 'SO-MULTI',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });
    const onToggleOrderExpanded = vi.fn();

    renderTable({ order, onToggleOrderExpanded });

    fireEvent.click(screen.getByLabelText('Expand order SO-MULTI'));

    expect(onToggleOrderExpanded).toHaveBeenCalledWith('so-multi');
  });

  it('marks cancelled item product name with supplier-order-item-cancelled class', () => {
    const order = makeOrder({
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          catalogProductId: 'cat-1',
          productName: 'Cancelled cable',
          quantity: 1,
          price: 100,
          receiptStatus: 'cancelled',
        },
      ],
    });

    renderTable({ order });

    expect(screen.getByText('Cancelled cable').closest('button')).toHaveClass(
      'supplier-order-item-cancelled',
    );
  });

  it('applies unpaid money styling and shows filtered totals', () => {
    const order = makeOrder({
      paymentStatus: 'pending',
      total: 500,
      paid: 100,
    });
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
        expandedOrderIds={new Set()}
        filteredOrdersCount={1}
        totals={{
          orderCount: 1,
          pcs: 5,
          total: 500,
          paid: 100,
          outstanding: 400,
        }}
        isLoading={false}
        openStatusOrder={null}
        page={1}
        pageSize={30}
        paginatedOrders={[order]}
        suppliers={[]}
        visibleColumns={['number', 'paid']}
        canViewSupplierOrders
        canManageSupplierOrders
        onError={vi.fn()}
        onEditOrder={vi.fn()}
        onOpenCatalogProduct={vi.fn()}
        onOpenSupplier={vi.fn()}
        onToggleFavorite={vi.fn()}
        onToggleOrderExpanded={vi.fn()}
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    expect(document.querySelector('.orders-money-unpaid')).toBeTruthy();
    expect(screen.getByText('1 orders')).toBeTruthy();
    expect(screen.getByText(/Outstanding/)).toBeTruthy();
  });

  it('copies product and supplier from the hover icon without opening cards', async () => {
    const onOpenCatalogProduct = vi.fn();
    const onOpenSupplier = vi.fn();
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);

    renderTable({
      catalogProducts: [catalogProduct],
      suppliers: [supplier],
      visibleColumns: ['number', 'product', 'supplier'],
      onOpenCatalogProduct,
      onOpenSupplier,
    });

    fireEvent.click(copyButtonFor('Type C cable'));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Type C cable');
    });

    fireEvent.click(copyButtonFor('Parts Hub'));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Parts Hub');
    });
    expect(onOpenCatalogProduct).not.toHaveBeenCalled();
    expect(onOpenSupplier).not.toHaveBeenCalled();
  });

  it('keeps product and supplier click flows', () => {
    const onOpenCatalogProduct = vi.fn();
    const onOpenSupplier = vi.fn();

    renderTable({
      catalogProducts: [catalogProduct],
      suppliers: [supplier],
      visibleColumns: ['number', 'product', 'supplier'],
      onOpenCatalogProduct,
      onOpenSupplier,
    });

    fireEvent.click(screen.getByText('Type C cable'));
    fireEvent.click(screen.getByText('Parts Hub'));

    expect(onOpenCatalogProduct).toHaveBeenCalledWith(catalogProduct);
    expect(onOpenSupplier).toHaveBeenCalledWith(supplier);
  });

  it('hides product and supplier copy controls when the value is empty', () => {
    renderTable({
      order: makeOrder({
        supplierName: '   ',
        items: [
          {
            lineId: 'line-1',
            itemIndex: 0,
            catalogProductId: 'cat-1',
            productName: '   ',
            quantity: 5,
            price: 100,
          },
        ],
      }),
      visibleColumns: ['number', 'product', 'supplier'],
    });

    expect(
      within(
        document.querySelector('.supplier-order-product-cell') as HTMLElement,
      ).queryByRole('button', { name: 'Copy' }),
    ).toBeNull();
    expect(
      within(
        document.querySelector('.supplier-order-supplier-cell') as HTMLElement,
      ).queryByRole('button', { name: 'Copy' }),
    ).toBeNull();
  });

  it('does not copy the collapsed multi-item product summary', () => {
    const order = makeOrder({
      id: 'so-multi',
      number: 'SO-MULTI',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });

    renderTable({
      order,
      visibleColumns: ['number', 'product', 'supplier'],
    });

    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(
      document.querySelector('.supplier-order-product-cell .copyable-value'),
    ).toBeNull();
    expect(copyButtonFor('SO-MULTI')).toBeInTheDocument();
    expect(copyButtonFor('Parts Hub')).toBeInTheDocument();
  });

  it('copies expanded child product names and skips child supplier placeholders', async () => {
    const copySpy = vi
      .spyOn(clipboard, 'copyTextToClipboard')
      .mockResolvedValue(true);
    const order = makeOrder({
      id: 'so-multi',
      number: 'SO-MULTI',
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable',
          quantity: 1,
          price: 10,
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Adapter',
          quantity: 2,
          price: 20,
        },
      ],
    });

    renderTable({
      order,
      expandedOrderIds: new Set(['so-multi']),
      visibleColumns: ['number', 'product', 'supplier'],
    });

    fireEvent.click(copyButtonFor('Cable'));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Cable');
    });
    fireEvent.click(copyButtonFor('Adapter'));
    await waitFor(() => {
      expect(copySpy).toHaveBeenCalledWith('Adapter');
    });

    const childSupplierCells = document.querySelectorAll(
      '.supplier-order-group-child .supplier-order-supplier-cell',
    );
    expect(childSupplierCells).toHaveLength(2);
    childSupplierCells.forEach((cell) => {
      expect(cell).toHaveTextContent('—');
      expect(
        within(cell as HTMLElement).queryByRole('button', { name: 'Copy' }),
      ).toBeNull();
    });
  });
});