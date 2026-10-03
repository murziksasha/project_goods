import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Supplier } from './model';
import { reorderSuppliers } from './service';
import { reorder } from './controller';
import { HttpError } from '../../shared/lib/errors';
import type { Request, Response } from 'express';

vi.mock('./model', () => ({
  Supplier: {
    bulkWrite: vi.fn(),
  },
}));

vi.mock('../supplier-order/model', () => ({
  SupplierOrder: {},
}));

describe('reorderSuppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 400 if items is empty or not an array', async () => {
    await expect(reorderSuppliers([])).rejects.toThrow(HttpError);

    await expect(
      // @ts-expect-error test invalid type
      reorderSuppliers(null),
    ).rejects.toThrow(HttpError);
  });

  it('calls bulkWrite with mapped updateOne operations', async () => {
    vi.mocked(Supplier.bulkWrite).mockResolvedValue({} as never);

    const result = await reorderSuppliers([
      { id: 'supp-1', sortOrder: 0 },
      { id: 'supp-2', sortOrder: 1 },
      { id: '', sortOrder: 2 },
      // @ts-expect-error test invalid sortOrder
      { id: 'supp-3', sortOrder: 'not-a-number' },
    ]);

    expect(Supplier.bulkWrite).toHaveBeenCalledTimes(1);
    expect(Supplier.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'supp-1' },
          update: { $set: { sortOrder: 0 } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'supp-2' },
          update: { $set: { sortOrder: 1 } },
        },
      },
    ]);
    expect(result).toEqual({ success: true, updatedCount: 2 });
  });

  it('handles controller reorder endpoint', async () => {
    vi.mocked(Supplier.bulkWrite).mockResolvedValue({} as never);

    const req = {
      employee: {
        id: 'emp-1',
        role: 'manager',
        permissions: ['supplierOrders.manage'],
      },
      body: {
        items: [{ id: 'supp-1', sortOrder: 0 }],
      },
    } as unknown as Request;

    const jsonMock = vi.fn();
    const res = {
      json: jsonMock,
    } as unknown as Response;

    await reorder(req, res);

    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      updatedCount: 1,
    });
  });
});
