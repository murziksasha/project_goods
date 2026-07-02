import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierOrder } from './model';
import { autoMarkOverdueSupplierOrders } from './service';

const state = {
  orders: [] as Array<Record<string, unknown>>,
};

beforeEach(() => {
  vi.restoreAllMocks();
  state.orders = [
    {
      _id: '507f1f77bcf86cd799439011',
      deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
      status: 'approved',
      receiptStatus: 'new',
    },
    {
      _id: '507f1f77bcf86cd799439012',
      deliveryDate: new Date('2026-07-10T10:00:00.000Z'),
      status: 'ordered',
      receiptStatus: 'new',
    },
  ];

  vi.spyOn(SupplierOrder, 'find').mockImplementation(
    () =>
      ({
        lean: async () => state.orders,
      }) as never,
  );
  vi.spyOn(SupplierOrder, 'updateMany').mockResolvedValue({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
    upsertedId: null,
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('autoMarkOverdueSupplierOrders', () => {
  it('marks only open orders with past delivery date as overdue', async () => {
    await autoMarkOverdueSupplierOrders(new Date('2026-07-02T12:00:00.000Z'));

    expect(SupplierOrder.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [state.orders[0]._id] } },
      { $set: { status: 'overdue' } },
    );
  });
});