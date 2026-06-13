import { describe, expect, it } from 'vitest';
import { formatSupplierOrder } from './formatters';

const makeOrder = (patch: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    orderBaseId: 'SO-1',
    supplier: { toString: () => '507f1f77bcf86cd799439012' },
    supplierName: 'Parts Hub',
    deliveryDate: new Date('2026-06-01T10:00:00.000Z'),
    supplyType: 'local',
    number: 'SO-1',
    note: '',
    createdBy: 'Owner',
    status: 'approved',
    paymentStatus: 'pending',
    receiptStatus: 'new',
    total: 100,
    paid: 0,
    items: [],
    createdAt: new Date('2026-06-01T09:00:00.000Z'),
    updatedAt: new Date('2026-06-01T09:00:00.000Z'),
    ...patch,
  }) as never;

describe('formatSupplierOrder', () => {
  it('includes favorite state', () => {
    expect(formatSupplierOrder(makeOrder({ isFavorite: true })).isFavorite).toBe(
      true,
    );
  });

  it('defaults missing favorite state to false for old documents', () => {
    expect(formatSupplierOrder(makeOrder()).isFavorite).toBe(false);
  });
});
