import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
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
  onToggleFavorite = vi.fn(),
}: {
  order?: SupplierOrder;
  onToggleFavorite?: (order: SupplierOrder) => void;
} = {}) => {
  render(
    <SupplierOrdersTable
      catalogProducts={[]}
      filteredOrdersCount={1}
      isLoading={false}
      openStatusOrder={null}
      page={1}
      pageSize={30}
      paginatedOrders={[order]}
      suppliers={[]}
      visibleColumns={['number', 'product']}
      canViewSupplierOrders
      canManageSupplierOrders
      onError={vi.fn()}
      onEditOrder={vi.fn()}
      onOpenCatalogProduct={vi.fn()}
      onOpenSupplier={vi.fn()}
      onToggleFavorite={onToggleFavorite}
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
    const paidOrder = makeOrder({ id: 'so-paid', paymentStatus: 'paid', number: 'SO-PAID' });
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
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
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    // find the number button by text content
    const numBtn = screen.getByText('SO-PAID');
    fireEvent.click(numBtn);

    expect(onEdit).toHaveBeenCalledWith(paidOrder);
    expect(onErr).not.toHaveBeenCalled();
  });

  it('opens (calls onEditOrder) for stocked supplier order (read-only after receipt)', () => {
    const onEdit = vi.fn();
    const stockedOrder = makeOrder({ id: 'so-stocked', status: 'stocked', number: 'SO-STK' });
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
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
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SO-STK'));
    expect(onEdit).toHaveBeenCalledWith(stockedOrder);
  });

  it('does not call onEditOrder and calls onError when no view permission', () => {
    const onEdit = vi.fn();
    const onErr = vi.fn();
    render(
      <SupplierOrdersTable
        catalogProducts={[]}
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
        onOpenStatusOrder={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SO-1'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(onErr).toHaveBeenCalled();
  });

  it('renders full long supplier order numbers for multi-item orders', () => {
    const longNumber = 'SO-1779142808517';
    const order = makeOrder({
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

    expect(screen.getByText(`${longNumber}-1`)).toBeInTheDocument();
    expect(screen.getByText(`${longNumber}-2`)).toBeInTheDocument();
  });
});
