import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';
import { CatalogProduct } from './model';
import {
  deleteCatalogProduct,
  listCatalogProducts,
  rebuildCatalogProductSearchTexts,
  updateCatalogProduct,
} from './service';

const catalogId = '507f1f77bcf86cd7994390aa';

const buildCatalog = (name: string, patch: Record<string, unknown> = {}) => ({
  _id: catalogId,
  name,
  note: '',
  isActive: true,
  sourceTags: ['manual'],
  lastSeenAt: new Date('2026-06-01T00:00:00.000Z'),
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  ...patch,
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

describe('updateCatalogProduct', () => {
  it('saves document so pre-validate rebuilds searchText after rename', async () => {
    const doc = {
      ...buildCatalog('Old Name', { searchText: 'old name', note: 'hint' }),
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      toObject: vi.fn(function toObject(this: typeof doc) {
        return {
          _id: this._id,
          name: this.name,
          note: this.note,
          isActive: this.isActive,
          sourceTags: this.sourceTags,
          lastSeenAt: this.lastSeenAt,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
          searchText: this.searchText,
        };
      }),
    };

    vi.spyOn(CatalogProduct, 'findById').mockResolvedValue(doc as never);
    vi.spyOn(Product, 'find').mockResolvedValue([] as never);
    vi.spyOn(SupplierOrder, 'find').mockResolvedValue([] as never);
    vi.spyOn(Sale, 'find').mockReturnValue(leanResult([]) as never);

    const result = await updateCatalogProduct(catalogId, {
      name: 'БЖ Lenovo 20V 3.25A 65W',
      note: 'updated note',
      isActive: true,
    });

    expect(doc.name).toBe('БЖ Lenovo 20V 3.25A 65W');
    expect(doc.note).toBe('updated note');
    expect(doc.validate).toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
    expect(result.name).toBe('БЖ Lenovo 20V 3.25A 65W');
  });

  it('throws when catalog product is missing', async () => {
    vi.spyOn(CatalogProduct, 'findById').mockResolvedValue(null);

    await expect(
      updateCatalogProduct(catalogId, { name: 'Anything', note: '', isActive: true }),
    ).rejects.toThrow('Catalog product not found.');
  });
});

describe('rebuildCatalogProductSearchTexts', () => {
  it('validates and saves only rows with stale searchText', async () => {
    const stale = {
      name: 'New Name',
      note: '',
      searchText: 'old name',
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    const fresh = {
      name: 'Fresh',
      note: 'n',
      searchText: 'fresh n',
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    vi.spyOn(CatalogProduct, 'find').mockResolvedValue([stale, fresh] as never);

    const result = await rebuildCatalogProductSearchTexts();

    expect(result).toEqual({ scanned: 2, updated: 1, alreadyConsistent: 1 });
    expect(stale.validate).toHaveBeenCalled();
    expect(stale.save).toHaveBeenCalled();
    expect(fresh.validate).not.toHaveBeenCalled();
    expect(fresh.save).not.toHaveBeenCalled();
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
