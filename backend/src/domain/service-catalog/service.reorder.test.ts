import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceCatalog } from './model';
import { reorderServiceCatalogItems } from './service';
import { reorder } from './controller';
import { HttpError } from '../../shared/lib/errors';
import type { Request, Response } from 'express';

vi.mock('./model', () => ({
  ServiceCatalog: {
    bulkWrite: vi.fn(),
  },
}));

vi.mock('../sale/model', () => ({
  Sale: {},
}));

describe('reorderServiceCatalogItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 400 if items is empty or not an array', async () => {
    await expect(
      reorderServiceCatalogItems([]),
    ).rejects.toThrow(HttpError);

    await expect(
      // @ts-expect-error test invalid type
      reorderServiceCatalogItems(null),
    ).rejects.toThrow(HttpError);
  });

  it('calls bulkWrite with mapped updateOne operations', async () => {
    vi.mocked(ServiceCatalog.bulkWrite).mockResolvedValue({} as never);

    const result = await reorderServiceCatalogItems([
      { id: 'srv-1', sortOrder: 0 },
      { id: 'srv-2', sortOrder: 1 },
      { id: '', sortOrder: 2 },
      // @ts-expect-error test invalid sortOrder
      { id: 'srv-3', sortOrder: 'not-a-number' },
    ]);

    expect(ServiceCatalog.bulkWrite).toHaveBeenCalledTimes(1);
    expect(ServiceCatalog.bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { _id: 'srv-1' },
          update: { $set: { sortOrder: 0 } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'srv-2' },
          update: { $set: { sortOrder: 1 } },
        },
      },
    ]);
    expect(result).toEqual({ success: true, updatedCount: 2 });
  });

  it('handles controller reorder endpoint', async () => {
    vi.mocked(ServiceCatalog.bulkWrite).mockResolvedValue({} as never);

    const req = {
      employee: { id: 'emp-1', role: 'manager', permissions: ['orders.manage'] },
      body: {
        items: [{ id: 'srv-1', sortOrder: 0 }],
      },
    } as unknown as Request;

    const jsonMock = vi.fn();
    const res = {
      json: jsonMock,
    } as unknown as Response;

    await reorder(req, res);

    expect(jsonMock).toHaveBeenCalledWith({ success: true, updatedCount: 1 });
  });
});
