import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierOrder } from './model';
import { autoMarkOverdueSupplierOrders } from './service';

const installFindMock = (orders: Array<Record<string, unknown>>) => {
  vi.spyOn(SupplierOrder, 'find').mockImplementation((query: unknown) => {
    const normalizedQuery = query as {
      status?: string | { $in?: string[] };
      receiptStatus?: { $ne?: string };
      items?: { $not?: { $elemMatch?: { receiptStatus?: string } } };
    };

    const filtered = orders.filter((order) => {
      const status = String(order.status ?? '');
      const receiptStatus = String(order.receiptStatus ?? '');
      const items = Array.isArray(order.items)
        ? (order.items as Array<{ receiptStatus?: string }>)
        : [];

      if (typeof normalizedQuery.status === 'string') {
        if (status !== normalizedQuery.status) {
          return false;
        }
      } else if (
        normalizedQuery.status?.$in &&
        !normalizedQuery.status.$in.includes(status)
      ) {
        return false;
      }

      if (
        normalizedQuery.receiptStatus?.$ne &&
        receiptStatus === normalizedQuery.receiptStatus.$ne
      ) {
        return false;
      }

      if (normalizedQuery.items?.$not?.$elemMatch?.receiptStatus) {
        const blockedReceiptStatus =
          normalizedQuery.items.$not.$elemMatch.receiptStatus;
        if (items.some((item) => item.receiptStatus === blockedReceiptStatus)) {
          return false;
        }
      }

      return true;
    });

    return {
      lean: async () => filtered,
    } as never;
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
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
  it('marks only request orders with past delivery date as overdue', async () => {
    const pastRequest = {
      _id: '507f1f77bcf86cd799439011',
      deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
      status: 'request',
      receiptStatus: 'new',
      items: [{ receiptStatus: 'new' }],
    };
    const pastOrdered = {
      _id: '507f1f77bcf86cd799439012',
      deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
      status: 'ordered',
      receiptStatus: 'new',
      items: [{ receiptStatus: 'new' }],
    };
    const futureRequest = {
      _id: '507f1f77bcf86cd799439013',
      deliveryDate: new Date('2026-07-10T10:00:00.000Z'),
      status: 'request',
      receiptStatus: 'new',
      items: [{ receiptStatus: 'new' }],
    };
    installFindMock([pastRequest, pastOrdered, futureRequest]);

    await autoMarkOverdueSupplierOrders(new Date('2026-07-02T12:00:00.000Z'));

    expect(SupplierOrder.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [pastRequest._id] } },
      { $set: { status: 'overdue' } },
    );
  });

  it('does not downgrade partially_stocked, approved, or manually set ordered orders', async () => {
    installFindMock([
      {
        _id: '507f1f77bcf86cd799439013',
        deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
        status: 'partially_stocked',
        receiptStatus: 'approved',
        items: [
          { receiptStatus: 'received' },
          { receiptStatus: 'new' },
        ],
      },
      {
        _id: '507f1f77bcf86cd799439014',
        deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
        status: 'approved',
        receiptStatus: 'new',
        items: [{ receiptStatus: 'new' }],
      },
      {
        _id: '507f1f77bcf86cd799439015',
        deliveryDate: new Date('2026-01-01T10:00:00.000Z'),
        status: 'ordered',
        receiptStatus: 'new',
        items: [{ receiptStatus: 'new' }],
      },
    ]);

    await autoMarkOverdueSupplierOrders(new Date('2026-07-02T12:00:00.000Z'));

    expect(SupplierOrder.updateMany).not.toHaveBeenCalled();
  });
});