import { describe, expect, it } from 'vitest';
import { resolveSupplierOrderStatusFromItems } from './status-resolver';

describe('resolveSupplierOrderStatusFromItems', () => {
  it('returns stocked when all items are received', () => {
    expect(
      resolveSupplierOrderStatusFromItems([
        { receiptStatus: 'received' },
        { receiptStatus: 'received' },
      ]),
    ).toEqual({ status: 'stocked', receiptStatus: 'received' });
  });

  it('returns partially_stocked when some items are received and others pending', () => {
    expect(
      resolveSupplierOrderStatusFromItems([
        { receiptStatus: 'received' },
        { receiptStatus: 'new' },
      ]),
    ).toEqual({ status: 'partially_stocked', receiptStatus: 'approved' });
  });

  it('returns partially_completed when all items are terminal with mixed received and cancelled', () => {
    expect(
      resolveSupplierOrderStatusFromItems([
        { receiptStatus: 'received' },
        { receiptStatus: 'cancelled' },
      ]),
    ).toEqual({ status: 'partially_completed', receiptStatus: 'approved' });
  });

  it('returns cancelled when all items are cancelled', () => {
    expect(
      resolveSupplierOrderStatusFromItems([
        { receiptStatus: 'cancelled' },
        { receiptStatus: 'cancelled' },
      ]),
    ).toEqual({ status: 'cancelled', receiptStatus: 'approved' });
  });

  it('returns null status when no items are received or cancelled', () => {
    expect(
      resolveSupplierOrderStatusFromItems([
        { receiptStatus: 'new' },
        { receiptStatus: 'approved' },
      ]),
    ).toEqual({ status: null, receiptStatus: 'approved' });
  });
});