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
});
