import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Product } from './model';
import { CatalogProduct } from '../catalog-product/model';
import { reorderProducts } from './service';
import { reorder } from './controller';
import { HttpError } from '../../shared/lib/errors';
import type { Request, Response } from 'express';

vi.mock('./model', () => ({
  Product: {
    bulkWrite: vi.fn(),
  },
}));

vi.mock('../catalog-product/model', () => ({
  CatalogProduct: {
    bulkWrite: vi.fn(),
  },
}));

vi.mock('../sale/model', () => ({
  Sale: {},
}));

vi.mock('../sequence/model', () => ({
  Sequence: {},
}));

describe('reorderProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 400 if items is empty or not an array', async () => {
    await expect(reorderProducts([])).rejects.toThrow(HttpError);
    // @ts-expect-error test invalid type
    await expect(reorderProducts(null)).rejects.toThrow(HttpError);
  });

  it('updates both Product and CatalogProduct with bulkWrite', async () => {
    vi.mocked(Product.bulkWrite).mockResolvedValue({} as never);
    vi.mocked(CatalogProduct.bulkWrite).mockResolvedValue({} as never);

    const result = await reorderProducts([
      { name: 'Display iPhone 13', sortOrder: 0 },
      { name: 'Battery iPhone 13', sortOrder: 1 },
      { name: '', sortOrder: 2 },
    ]);

    expect(Product.bulkWrite).toHaveBeenCalledTimes(1);
    expect(CatalogProduct.bulkWrite).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ success: true, updatedCount: 2 });
  });

  it('handles controller reorder endpoint', async () => {
    vi.mocked(Product.bulkWrite).mockResolvedValue({} as never);
    vi.mocked(CatalogProduct.bulkWrite).mockResolvedValue({} as never);

    const req = {
      employee: { id: 'emp-1', role: 'manager', permissions: ['orders.manage'] },
      body: {
        items: [{ name: 'Display iPhone 13', sortOrder: 0 }],
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
