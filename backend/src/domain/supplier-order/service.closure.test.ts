import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { updateSupplierOrder } from './service';

const state = {
  supplierOrder: undefined as Record<string, unknown> | undefined,
};

const buildSupplierOrder = (
  patch: Record<string, unknown> = {},
) => ({
  _id: '507f1f77bcf86cd799439011',
  orderBaseId: 'SO-1',
  number: 'SO-1',
  supplier: '507f1f77bcf86cd799439012',
  deliveryDate: new Date('2026-07-10T00:00:00.000Z'),
  supplyType: 'Local',
  note: '',
  createdBy: 'Owner',
  status: 'approved',
  paymentStatus: 'paid',
  receiptStatus: 'approved',
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'Cable',
      quantity: 1,
      price: 100,
      receiptStatus: 'new',
    },
  ],
  total: 100,
  paid: 100,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  validate: vi.fn(async () => undefined),
  save: vi.fn(async () => undefined),
  toObject: vi.fn(function toObject(this: Record<string, unknown>) {
    return this;
  }),
  ...patch,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  state.supplierOrder = buildSupplierOrder();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  vi.spyOn(SupplierOrder, 'findById').mockImplementation(
    async () => state.supplierOrder as never,
  );
  vi.spyOn(SupplierOrder, 'updateMany').mockResolvedValue({
    modifiedCount: 0,
  } as never);
  vi.spyOn(Supplier, 'find').mockReturnValue({
    select: () =>
      leanResult([
        { _id: '507f1f77bcf86cd799439012', name: 'Cable Supplier' },
      ]),
  } as never);
});

describe('updateSupplierOrder closure statuses', () => {
  it('allows paid orders to move to unavailable without changing paymentStatus', async () => {
    const result = await updateSupplierOrder('507f1f77bcf86cd799439011', {
      status: 'unavailable',
    });

    expect(result.status).toBe('unavailable');
    expect(result.paymentStatus).toBe('paid');
    expect(state.supplierOrder?.status).toBe('unavailable');
    expect(state.supplierOrder?.paymentStatus).toBe('paid');
  });

  it('allows paid orders to move to cancelled without changing paymentStatus', async () => {
    const result = await updateSupplierOrder('507f1f77bcf86cd799439011', {
      status: 'cancelled',
    });

    expect(result.status).toBe('cancelled');
    expect(result.paymentStatus).toBe('paid');
  });

  it('sets paymentStatus to cancelled when pending order is cancelled', async () => {
    state.supplierOrder = buildSupplierOrder({
      paymentStatus: 'pending',
      paid: 0,
    });

    const result = await updateSupplierOrder('507f1f77bcf86cd799439011', {
      status: 'cancelled',
    });

    expect(result.status).toBe('cancelled');
    expect(result.paymentStatus).toBe('cancelled');
  });

  it('still blocks regular edits for paid orders', async () => {
    await expect(
      updateSupplierOrder('507f1f77bcf86cd799439011', {
        supplierId: '507f1f77bcf86cd799439012',
        deliveryDate: '2026-07-12',
        items: buildSupplierOrder().items,
        note: 'changed',
      }),
    ).rejects.toThrow('Оплачений заказ не можна редагувати.');
  });
});