import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptRow } from '../model/warehouse-panel';
import { ReceiptsTable } from './WarehouseTables';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
