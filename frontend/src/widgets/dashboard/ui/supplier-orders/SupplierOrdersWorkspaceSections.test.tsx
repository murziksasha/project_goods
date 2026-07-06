import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupplierOrder } from '../../../../entities/supplier-order/model/types';
import { SupplierOrdersTable } from './SupplierOrdersWorkspaceSections';

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
  onToggleFavorite = vi.fn(),
  onEditOrder = vi.fn(),
  onToggleOrderExpanded = vi.fn(),
}: {
  order?: SupplierOrder;
  expandedOrderIds?: Set<string>;
  onToggleFavorite?: (order: SupplierOrder) => void;
  onEditOrder?: (
    order: SupplierOrder,
    sourceOrder: SupplierOrder,
    itemIndex: number | null,
  ) => void;
  onToggleOrderExpanded?: (orderId: string) => void;
} = {}) => {
  render(
    <SupplierOrdersTable
      catalogProducts={[]}
      expandedOrderIds={expandedOrderIds}
      filteredOrdersCount={1}
      isLoading={false}
      openStatusOrder={null}
      page={1}
      pageSize={30}
      paginatedOrders={[order]}
      suppliers={[]}
      visibleColumns={['number', 'product', 'status', 'paymentStatus']}
      canViewSupplierOrders
      canManageSupplierOrders
      onError={vi.fn()}
      onEditOrder={onEditOrder}
      onOpenCatalogProduct={vi.fn()}
      onOpenSupplier={vi.fn()}
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

  it('opens full-order modal from parent row and item modal from child row', () => {
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

    expect(screen.getByText('Cancelled cable')).toHaveClass('supplier-order-item-cancelled');
  });
});