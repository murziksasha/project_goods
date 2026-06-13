import { describe, expect, it } from 'vitest';
import {
  filterReceiptRows,
  initialWarehouseFilters,
  type ReceiptRow,
} from './warehouse-panel';

const makeReceipt = (patch: Partial<ReceiptRow> = {}): ReceiptRow => ({
  id: 'receipt-1',
  number: 'SO-1',
  supplierOrderId: 'so-1',
  supplierOrderItemIndex: 0,
  catalogProductId: 'cat-1',
  productName: 'Type C cable',
  quantity: 2,
  price: 100,
  amount: 200,
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
  ...patch,
});

describe('warehouse-panel receipts filtering', () => {
  it('keeps only receipts linked to starred supplier orders', () => {
    const receipts = [
      makeReceipt(),
      makeReceipt({
        id: 'receipt-2',
        number: 'SO-2',
        supplierOrderId: 'so-2',
        supplierOrderIsFavorite: true,
      }),
      makeReceipt({
        id: 'manual-1',
        number: 'R-1',
        supplierOrderId: undefined,
        supplierOrderIsFavorite: undefined,
      }),
    ];

    expect(
      filterReceiptRows({
        receipts,
        query: '',
        filters: { ...initialWarehouseFilters, favoritesOnly: true },
      }).map((receipt) => receipt.id),
    ).toEqual(['receipt-2']);
  });
});
