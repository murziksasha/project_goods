import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { cancelSupplierOrder } from './service';

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
  deliveryDate: new Date('2026-01-05T00:00:00.000Z'),
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
  vi.spyOn(Supplier, 'findById').mockReturnValue(
    leanResult({ _id: 'supplier-1', name: 'Cable Supplier' }) as never,
  );
});

describe('cancelSupplierOrder', () => {
  it('rejects cancellation for paid orders', async () => {
    await expect(
      cancelSupplierOrder('507f1f77bcf86cd799439011'),
    ).rejects.toThrow('Оплачений заказ не можна скасувати.');
  });

  it('rejects cancellation for without_payment orders', async () => {
    state.supplierOrder = buildSupplierOrder({
      paymentStatus: 'without_payment',
      paid: 0,
    });

    await expect(
      cancelSupplierOrder('507f1f77bcf86cd799439011'),
    ).rejects.toThrow('Оплачений заказ не можна скасувати.');
  });

  it('cancels approved pending orders that are not received yet', async () => {
    state.supplierOrder = buildSupplierOrder({
      paymentStatus: 'pending',
      paid: 0,
    });

    const result = await cancelSupplierOrder('507f1f77bcf86cd799439011');

    expect(result.status).toBe('cancelled');
    expect(result.paymentStatus).toBe('cancelled');
    expect(state.supplierOrder?.status).toBe('cancelled');
    expect(state.supplierOrder?.paymentStatus).toBe('cancelled');
  });

  it('rejects cancellation for stocked orders', async () => {
    state.supplierOrder = buildSupplierOrder({
      status: 'stocked',
      receiptStatus: 'received',
      paymentStatus: 'pending',
      paid: 0,
    });

    await expect(
      cancelSupplierOrder('507f1f77bcf86cd799439011'),
    ).rejects.toThrow('Оприбутковане замовлення не можна скасувати.');
  });

  it('rejects cancellation for received orders', async () => {
    state.supplierOrder = buildSupplierOrder({
      status: 'approved',
      receiptStatus: 'received',
      paymentStatus: 'pending',
      paid: 0,
    });

    await expect(
      cancelSupplierOrder('507f1f77bcf86cd799439011'),
    ).rejects.toThrow('Оприбутковане замовлення не можна скасувати.');
  });

  it('rejects repeated cancellation', async () => {
    state.supplierOrder = buildSupplierOrder({
      status: 'cancelled',
      paymentStatus: 'cancelled',
    });

    await expect(
      cancelSupplierOrder('507f1f77bcf86cd799439011'),
    ).rejects.toThrow('Замовлення вже скасовано.');
  });
});