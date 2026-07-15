import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { updateSupplierOrder, updateSupplierOrderFavorite } from './service';

const state = {
  supplierOrder: undefined as Record<string, unknown> | undefined,
};

const buildSupplierOrder = (patch: Record<string, unknown> = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  orderBaseId: 'SO-1',
  number: 'SO-1',
  supplier: '507f1f77bcf86cd799439012',
  deliveryDate: new Date('2026-07-10T00:00:00.000Z'),
  supplyType: 'Local',
  note: 'Old note',
  createdBy: 'Owner',
  status: 'request',
  paymentStatus: 'pending',
  receiptStatus: 'new',
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
  paid: 0,
  isFavorite: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  validate: vi.fn(async () => undefined),
  save: vi.fn(async () => undefined),
  set: vi.fn(function setField(this: Record<string, unknown>, key: string, value: unknown) {
    this[key] = value;
  }),
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

describe('updateSupplierOrder status transitions', () => {
  it('rejects edits when paymentStatus is paid', async () => {
    state.supplierOrder = buildSupplierOrder({
      status: 'approved',
      paymentStatus: 'paid',
      paid: 100,
    });

    await expect(
      updateSupplierOrder('507f1f77bcf86cd799439011', {
        note: 'try edit',
      }),
    ).rejects.toThrow('Оплачений заказ не можна редагувати.');
  });

  it('updates note and items for pending orders', async () => {
    const result = await updateSupplierOrder('507f1f77bcf86cd799439011', {
      supplierId: '507f1f77bcf86cd799439012',
      deliveryDate: '2026-08-01T00:00:00.000Z',
      note: 'Updated note',
      items: [
        {
          productName: 'Cable Pro',
          quantity: 2,
          price: 50,
        },
      ],
    });

    expect(state.supplierOrder?.note).toBe('Updated note');
    expect(state.supplierOrder?.save).toHaveBeenCalled();
    expect(result.supplierName).toBe('Cable Supplier');
  });

  it('sets paymentStatus pending when moving to approved', async () => {
    await updateSupplierOrder('507f1f77bcf86cd799439011', {
      supplierId: '507f1f77bcf86cd799439012',
      deliveryDate: '2026-07-10T00:00:00.000Z',
      status: 'approved',
      items: [
        {
          productName: 'Cable',
          quantity: 1,
          price: 100,
        },
      ],
    });

    expect(state.supplierOrder?.status).toBe('approved');
    expect(state.supplierOrder?.paymentStatus).toBe('pending');
  });

  it('throws when order is missing', async () => {
    vi.spyOn(SupplierOrder, 'findById').mockResolvedValue(null as never);

    await expect(
      updateSupplierOrder('507f1f77bcf86cd799439011', { note: 'x' }),
    ).rejects.toThrow('Supplier order not found.');
  });
});

describe('updateSupplierOrderFavorite', () => {
  it('toggles isFavorite', async () => {
    const result = await updateSupplierOrderFavorite('507f1f77bcf86cd799439011', {
      isFavorite: true,
    });

    expect(state.supplierOrder?.isFavorite).toBe(true);
    expect(result.isFavorite).toBe(true);
  });
});
