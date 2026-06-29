import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state, findMock, updateManyMock } = vi.hoisted(() => {
  const sharedState = {
    sortArgs: undefined as unknown,
    queueOrders: [] as Record<string, unknown>[],
  };

  return {
    state: sharedState,
    findMock: vi.fn(() => ({
      sort: (sortArgs: unknown) => {
        sharedState.sortArgs = sortArgs;
        return {
          lean: async () => sharedState.queueOrders,
        };
      },
    })),
    updateManyMock: vi.fn(async () => ({ modifiedCount: 0 })),
  };
});

vi.mock('../supplier/model', () => ({
  Supplier: {
    findById: vi.fn(() => ({
      lean: async () => ({ _id: 'supplier-1', name: 'Cable Supplier' }),
    })),
  },
}));

vi.mock('./model', () => ({
  receiptStatuses: ['new', 'approved', 'received'],
  supplierOrderStatuses: [
    'request',
    'ordered',
    'approved',
    'stocked',
    'overdue',
    'cancelled',
    'unavailable',
  ],
  supplierPaymentStatuses: [
    'pending',
    'paid',
    'without_payment',
    'cancelled',
  ],
  SupplierOrder: {
    find: findMock,
    updateMany: updateManyMock,
  },
}));

import { SupplierOrder } from './model';
import { listSupplierOrdersForAccounting } from './service';

const buildQueueOrder = (
  id: string,
  createdAt: string,
  deliveryDate = '2026-06-01T00:00:00.000Z',
) => ({
  _id: id,
  orderBaseId: `SO-${id}`,
  number: `SO-${id}`,
  supplier: '507f1f77bcf86cd799439012',
  deliveryDate: new Date(deliveryDate),
  supplyType: 'Local',
  note: '',
  createdBy: 'Owner',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  items: [],
  total: 100,
  paid: 0,
  createdAt: new Date(createdAt),
  updatedAt: new Date(createdAt),
});

describe('listSupplierOrdersForAccounting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sortArgs = undefined;
    state.queueOrders = [
      buildQueueOrder('order-new', '2026-06-03T00:00:00.000Z'),
      buildQueueOrder('order-middle', '2026-06-02T00:00:00.000Z'),
      buildQueueOrder('order-old', '2026-06-01T00:00:00.000Z'),
    ];
  });

  it('requests newest supplier orders first', async () => {
    await listSupplierOrdersForAccounting();

    expect(SupplierOrder.find).toHaveBeenCalledWith({
      status: { $in: ['approved', 'stocked'] },
      paymentStatus: 'pending',
      total: { $gt: 0 },
    });
    expect(state.sortArgs).toEqual({ createdAt: -1 });
  });

  it('returns queue items in the order provided by the query', async () => {
    const result = await listSupplierOrdersForAccounting();

    expect(result.map((order) => order.id)).toEqual([
      'order-new',
      'order-middle',
      'order-old',
    ]);
    expect(result[0]?.createdAt).toBe('2026-06-03T00:00:00.000Z');
  });
});