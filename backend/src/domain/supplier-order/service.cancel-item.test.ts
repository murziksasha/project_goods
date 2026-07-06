import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { cancelSupplierOrderItem } from './service';
import { applySupplierOrderFinancialTotals } from './totals';

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
  paymentStatus: 'pending',
  receiptStatus: 'approved',
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      productName: 'Cable A',
      quantity: 1,
      price: 100,
      receiptStatus: 'new',
    },
    {
      lineId: 'line-2',
      itemIndex: 1,
      productName: 'Cable B',
      quantity: 1,
      price: 50,
      receiptStatus: 'new',
    },
  ],
  total: 150,
  paid: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  validate: vi.fn(async function validateSupplierOrder(this: Record<string, unknown>) {
    const totals = applySupplierOrderFinancialTotals({
      items: (this.items as Array<{
        quantity?: number;
        price?: number;
        receiptStatus?: string;
      }>) ?? [],
      paymentStatus: String(this.paymentStatus ?? 'pending'),
      paid: Number(this.paid ?? 0),
      isPaymentStatusModified: false,
    });
    this.total = totals.total;
    this.paid = totals.paid;
  }),
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

describe('cancelSupplierOrderItem', () => {
  it('cancels one pending item and keeps order partially_stocked when another item is received', async () => {
    state.supplierOrder = buildSupplierOrder({
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable A',
          quantity: 1,
          price: 100,
          receiptStatus: 'received',
        },
        {
          lineId: 'line-2',
          itemIndex: 1,
          productName: 'Cable B',
          quantity: 1,
          price: 50,
          receiptStatus: 'new',
        },
      ],
    });

    const result = await cancelSupplierOrderItem('507f1f77bcf86cd799439011', {
      itemIndex: 1,
      reason: 'Supplier unavailable',
    });

    expect(result.status).toBe('partially_completed');
    expect(result.items[1]?.receiptStatus).toBe('cancelled');
    expect(result.total).toBe(100);
    expect(result.paymentStatus).toBe('pending');
    expect(result.note).toContain('[ITEM_CANCELLED:1] Supplier unavailable');
  });

  it('sets partially_stocked when one pending item is cancelled and another remains open', async () => {
    const result = await cancelSupplierOrderItem('507f1f77bcf86cd799439011', {
      itemIndex: 0,
    });

    expect(result.status).toBe('partially_stocked');
    expect(result.items[0]?.receiptStatus).toBe('cancelled');
    expect(result.items[1]?.receiptStatus).toBe('new');
    expect(result.total).toBe(50);
    expect(result.paymentStatus).toBe('pending');
  });

  it('allows cancelling a pending item on a paid order without changing paymentStatus', async () => {
    state.supplierOrder = buildSupplierOrder({
      paymentStatus: 'paid',
      paid: 150,
    });

    const result = await cancelSupplierOrderItem('507f1f77bcf86cd799439011', {
      itemIndex: 0,
    });

    expect(result.items[0]?.receiptStatus).toBe('cancelled');
    expect(result.paymentStatus).toBe('paid');
    expect(result.total).toBe(50);
    expect(result.paid).toBe(150);
  });

  it('rejects cancelling an already received item', async () => {
    state.supplierOrder = buildSupplierOrder({
      items: [
        {
          lineId: 'line-1',
          itemIndex: 0,
          productName: 'Cable A',
          quantity: 1,
          price: 100,
          receiptStatus: 'received',
        },
      ],
    });

    await expect(
      cancelSupplierOrderItem('507f1f77bcf86cd799439011', { itemIndex: 0 }),
    ).rejects.toThrow('Received supplier order item cannot be cancelled.');
  });
});