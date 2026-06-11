import { describe, expect, it } from 'vitest';
import {
  normalizeItems,
  toOrderStatus,
  toPaymentStatus,
  toReceiptStatus,
} from './normalizers';

describe('supplier-order normalizers', () => {
  it('normalizes valid items and preserves existing receipt status by item index', () => {
    expect(
      normalizeItems(
        [
          { productName: ' Phone ', quantity: '2', price: '834,48', itemIndex: '3' },
          { productName: 'x', quantity: '1', price: '5' },
        ],
        [{ itemIndex: 3, receiptStatus: 'approved' }],
      ),
    ).toEqual([
      {
        lineId: 'line-1',
        itemIndex: 3,
        catalogProductId: undefined,
        productName: 'Phone',
        quantity: 2,
        price: 834.48,
        receiptStatus: 'approved',
      },
    ]);
  });

  it('falls back for unsupported statuses', () => {
    expect(toOrderStatus('missing')).toBe('request');
    expect(toPaymentStatus('missing')).toBe('pending');
    expect(toReceiptStatus('missing')).toBe('new');
  });
});
