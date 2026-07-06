import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierOrder } from './model';
import { reconcileSupplierOrderStatuses } from './service';

const buildOrder = (overrides: Record<string, unknown> = {}) => {
  const order = {
    _id: '507f1f77bcf86cd799439011',
    status: 'overdue',
    receiptStatus: 'new',
    paymentStatus: 'pending',
    items: [
      { itemIndex: 0, receiptStatus: 'received' },
      { itemIndex: 1, receiptStatus: 'new' },
    ],
    validate: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
    ...overrides,
  };
  return order;
};

describe('reconcileSupplierOrderStatuses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('repairs overdue orders that already have received items', async () => {
    const order = buildOrder();
    vi.spyOn(SupplierOrder, 'find').mockResolvedValue([order] as never);

    await reconcileSupplierOrderStatuses();

    expect(order.status).toBe('partially_stocked');
    expect(order.receiptStatus).toBe('approved');
    expect(order.validate).toHaveBeenCalled();
    expect(order.save).toHaveBeenCalled();
  });

  it('skips orders that already match resolved status', async () => {
    const order = buildOrder({
      status: 'partially_stocked',
      receiptStatus: 'approved',
    });
    vi.spyOn(SupplierOrder, 'find').mockResolvedValue([order] as never);

    await reconcileSupplierOrderStatuses();

    expect(order.save).not.toHaveBeenCalled();
  });
});