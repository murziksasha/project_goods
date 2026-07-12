import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Sale } from '../sale/model';
import { CatalogProduct } from './model';
import {
  deleteCatalogProduct,
  listCatalogProducts,
} from './service';

const catalogId = '507f1f77bcf86cd7994390aa';

const buildCatalog = (name: string) => ({
  _id: catalogId,
  name,
  note: '',
  isActive: true,
  sourceTags: ['manual'],
  lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
});

describe('listCatalogProducts', () => {
  it('loads sales once and computes usage counts in memory', async () => {
    const items = [buildCatalog('iPhone Screen'), buildCatalog('Battery')];
    vi.spyOn(CatalogProduct, 'find').mockReturnValue({
      sort: () => leanResult(items),
    } as never);
    const saleFind = vi.spyOn(Sale, 'find').mockReturnValue(
      leanResult([
        {
          productSnapshot: { name: 'iPhone Screen' },
          lineItems: [],
          note: '',
        },
        {
          productSnapshot: { name: 'Other' },
          lineItems: [{ name: 'iPhone Screen (OEM)' }],
          note: '',
        },
      ]) as never,
    );

    const result = await listCatalogProducts('');

    expect(saleFind).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    const screen = result.find((row) => row.name === 'iPhone Screen');
    const battery = result.find((row) => row.name === 'Battery');
    expect(screen?.usageCount).toBe(2);
    expect(battery?.usageCount).toBe(0);
  });
});

describe('deleteCatalogProduct', () => {
  it('blocks delete when product is used in sales', async () => {
    vi.spyOn(CatalogProduct, 'findById').mockReturnValue(
      leanResult(buildCatalog('iPhone Screen')) as never,
    );
    vi.spyOn(Sale, 'find').mockReturnValue(
      leanResult([
        {
          productSnapshot: { name: 'iPhone Screen' },
          lineItems: [],
          note: '',
        },
      ]) as never,
    );

    await expect(deleteCatalogProduct(catalogId)).rejects.toThrow(
      'This product is used in orders or sales and cannot be removed.',
    );
  });

  it('deletes unused catalog products', async () => {
    vi.spyOn(CatalogProduct, 'findById').mockReturnValue(
      leanResult(buildCatalog('Unused Part')) as never,
    );
    vi.spyOn(Sale, 'find').mockReturnValue(leanResult([]) as never);
    const deleteSpy = vi.spyOn(CatalogProduct, 'findByIdAndDelete').mockReturnValue(
      leanResult(buildCatalog('Unused Part')) as never,
    );

    const result = await deleteCatalogProduct(catalogId);

    expect(deleteSpy).toHaveBeenCalledWith(catalogId);
    expect(result).toEqual({ id: catalogId });
  });
});
