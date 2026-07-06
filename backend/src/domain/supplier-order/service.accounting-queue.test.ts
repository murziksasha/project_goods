import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Supplier } from '../supplier/model';
import { SupplierOrder } from './model';
import { listSupplierOrdersForAccounting } from './service';

const state = {
  sortArgs: undefined as unknown,
  queueOrders: [] as Record<string, unknown>[],
};

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

const installSpies = () => {
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => 0,
  });

  vi.spyOn(SupplierOrder, 'find').mockImplementation(
    (query: unknown) =>
      ({
        sort: (sortArgs: unknown) => {
          state.sortArgs = sortArgs;
          return leanResult(state.queueOrders);
        },
      }) as never,
  );
  vi.spyOn(SupplierOrder, 'updateMany').mockResolvedValue({
    modifiedCount: 0,
  } as never);
  vi.spyOn(Supplier, 'findById').mockReturnValue(
    leanResult({ _id: 'supplier-1', name: 'Cable Supplier' }) as never,
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  state.sortArgs = undefined;
  state.queueOrders = [
    buildQueueOrder('order-new', '2026-06-03T00:00:00.000Z'),
    buildQueueOrder('order-middle', '2026-06-02T00:00:00.000Z'),
    buildQueueOrder('order-old', '2026-06-01T00:00:00.000Z'),
  ];
  installSpies();
});

describe('listSupplierOrdersForAccounting', () => {
  it('requests newest supplier orders first', async () => {
    await listSupplierOrdersForAccounting();

    expect(SupplierOrder.find).toHaveBeenCalledWith({
      status: {
        $in: [
          'approved',
          'overdue',
          'partially_stocked',
          'partially_completed',
          'stocked',
        ],
      },
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