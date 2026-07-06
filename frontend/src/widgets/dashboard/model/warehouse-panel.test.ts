import { describe, expect, it } from 'vitest';
import {
  filterReceiptRows,
  initialWarehouseFilters,
  normalizeReceiptStatuses,
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

  it('filters receipts by a single selected status', () => {
    const receipts = [
      makeReceipt({ id: 'receipt-new', status: 'new' }),
      makeReceipt({ id: 'receipt-received', status: 'received' }),
      makeReceipt({ id: 'receipt-cancelled', status: 'cancelled' }),
    ];

    expect(
      filterReceiptRows({
        receipts,
        query: '',
        filters: { ...initialWarehouseFilters, statuses: ['received'] },
      }).map((receipt) => receipt.id),
    ).toEqual(['receipt-received']);

    expect(
      filterReceiptRows({
        receipts,
        query: '',
        filters: initialWarehouseFilters,
      }).map((receipt) => receipt.id),
    ).toEqual(['receipt-new', 'receipt-received', 'receipt-cancelled']);
  });

  it('filters receipts by multiple selected statuses', () => {
    const receipts = [
      makeReceipt({ id: 'receipt-new', status: 'new' }),
      makeReceipt({ id: 'receipt-approved', status: 'approved' }),
      makeReceipt({ id: 'receipt-received', status: 'received' }),
      makeReceipt({ id: 'receipt-cancelled', status: 'cancelled' }),
    ];

    expect(
      filterReceiptRows({
        receipts,
        query: '',
        filters: {
          ...initialWarehouseFilters,
          statuses: ['new', 'approved'],
        },
      }).map((receipt) => receipt.id),
    ).toEqual(['receipt-new', 'receipt-approved']);
  });

  it('combines status and favorites filters', () => {
    const receipts = [
      makeReceipt({
        id: 'receipt-starred-received',
        status: 'received',
        supplierOrderIsFavorite: true,
      }),
      makeReceipt({
        id: 'receipt-starred-new',
        status: 'new',
        supplierOrderIsFavorite: true,
      }),
      makeReceipt({
        id: 'receipt-received',
        status: 'received',
        supplierOrderIsFavorite: false,
      }),
    ];

    expect(
      filterReceiptRows({
        receipts,
        query: '',
        filters: {
          ...initialWarehouseFilters,
          statuses: ['received'],
          favoritesOnly: true,
        },
      }).map((receipt) => receipt.id),
    ).toEqual(['receipt-starred-received']);
  });
});

describe('normalizeReceiptStatuses', () => {
  it('returns an empty array when no statuses are selected', () => {
    expect(normalizeReceiptStatuses()).toEqual([]);
    expect(normalizeReceiptStatuses({ statuses: [] })).toEqual([]);
  });

  it('keeps only supported receipt statuses', () => {
    expect(
      normalizeReceiptStatuses({
        statuses: ['new', 'received', 'invalid' as never],
      }),
    ).toEqual(['new', 'received']);
  });

  it('migrates legacy single status values', () => {
    expect(normalizeReceiptStatuses({ status: 'cancelled' })).toEqual([
      'cancelled',
    ]);
    expect(normalizeReceiptStatuses({ status: '' })).toEqual([]);
    expect(normalizeReceiptStatuses({ status: 'invalid' as never })).toEqual(
      [],
    );
  });
});