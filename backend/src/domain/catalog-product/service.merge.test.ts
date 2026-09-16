import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leanResult } from '../../test/mongoose-mocks';
import { Product } from '../product/model';
import { Sale } from '../sale/model';
import { SupplierOrder } from '../supplier-order/model';
import { CatalogProduct } from './model';
import { mergeCatalogProducts } from './service';

const targetProductId = '507f1f77bcf86cd799439055';
const sourceProductId = '507f1f77bcf86cd799439066';

const createMockCatalogProduct = (
  id: string,
  name: string,
  note = '',
  sourceTags: string[] = ['manual'],
  lastSeenAt = new Date('2026-01-01T00:00:00.000Z'),
) => {
  const doc: any = {
    _id: new mongoose.Types.ObjectId(id),
    name,
    note,
    sourceTags,
    lastSeenAt,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    validate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this;
    },
  };
  return doc;
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.spyOn(mongoose, 'isValidObjectId').mockImplementation(
    (value: unknown) =>
      typeof value === 'string' && /^[a-f\d]{24}$/i.test(value),
  );
  vi.spyOn(Sale, 'find').mockReturnValue({
    lean: vi.fn().mockResolvedValue([]),
  } as never);
  vi.spyOn(SupplierOrder, 'find').mockResolvedValue([] as never);
  vi.spyOn(Product, 'find').mockResolvedValue([] as never);
});

describe('mergeCatalogProducts', () => {
  it('rejects invalid or missing IDs', async () => {
    await expect(
      mergeCatalogProducts('', sourceProductId),
    ).rejects.toThrow(
      'Both targetCatalogProductId and sourceCatalogProductId are required.',
    );
    await expect(
      mergeCatalogProducts(targetProductId, targetProductId),
    ).rejects.toThrow('Select two different catalog products.');
    await expect(
      mergeCatalogProducts('bad', sourceProductId),
    ).rejects.toThrow('Valid targetCatalogProductId is required.');
  });

  it('rejects when target or source does not exist', async () => {
    vi.spyOn(CatalogProduct, 'findById').mockResolvedValue(null);
    await expect(
      mergeCatalogProducts(targetProductId, sourceProductId),
    ).rejects.toThrow('Target catalog product not found.');
  });

  it('consolidates notes and metadata, relinks sales, orders, and stock, and deletes source', async () => {
    const target = createMockCatalogProduct(
      targetProductId,
      'USB-C Cable 1m',
      'Target note',
      ['manual'],
      new Date('2026-02-01T00:00:00.000Z'),
    );
    const source = createMockCatalogProduct(
      sourceProductId,
      'usb-c cable 1m',
      'Source note',
      ['order-card'],
      new Date('2026-03-01T00:00:00.000Z'),
    );

    vi.spyOn(CatalogProduct, 'findById').mockImplementation(((
      id: string,
    ) => {
      if (id === targetProductId) return Promise.resolve(target);
      if (id === sourceProductId) return Promise.resolve(source);
      return Promise.resolve(null);
    }) as never);

    // Mock stock product
    const stockProduct: any = {
      _id: 'prod-1',
      name: 'usb-c cable 1m',
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(Product, 'find').mockResolvedValue([
      stockProduct,
    ] as never);

    // Mock supplier order
    const supplierOrder: any = {
      _id: 'order-1',
      items: [
        {
          catalogProductId: new mongoose.Types.ObjectId(
            sourceProductId,
          ),
          productName: 'usb-c cable 1m',
          quantity: 5,
          price: 50,
        },
      ],
      set: vi.fn(),
      validate: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(SupplierOrder, 'find').mockResolvedValue([
      supplierOrder,
    ] as never);

    // Mock sale
    const linkedSale = {
      _id: 'sale-1',
      productSnapshot: {
        article: 'CBL-01',
        name: 'usb-c cable 1m',
        serialNumber: '',
      },
      lineItems: [
        {
          kind: 'product',
          catalogProductId: new mongoose.Types.ObjectId(
            sourceProductId,
          ),
          name: 'usb-c cable 1m',
          price: 120,
          quantity: 2,
        },
      ],
    };
    vi.spyOn(Sale, 'find').mockReturnValue({
      lean: vi.fn().mockResolvedValue([linkedSale]),
    } as never);

    const saleFindByIdAndUpdate = vi
      .spyOn(Sale, 'findByIdAndUpdate')
      .mockResolvedValue({} as never);
    const catalogFindByIdAndDelete = vi
      .spyOn(CatalogProduct, 'findByIdAndDelete')
      .mockReturnValue(leanResult(source) as never);

    const result = await mergeCatalogProducts(
      targetProductId,
      sourceProductId,
      'Draft note',
    );

    // 1. Stock product renamed
    expect(stockProduct.name).toBe('USB-C Cable 1m');
    expect(stockProduct.save).toHaveBeenCalled();

    // 2. Supplier order updated
    expect(supplierOrder.set).toHaveBeenCalledWith('items', [
      {
        catalogProductId: target._id,
        productName: 'USB-C Cable 1m',
        quantity: 5,
        price: 50,
      },
    ]);
    expect(supplierOrder.save).toHaveBeenCalled();

    // 3. Sale updated
    expect(saleFindByIdAndUpdate).toHaveBeenCalledWith(
      'sale-1',
      {
        productSnapshot: {
          article: 'CBL-01',
          name: 'USB-C Cable 1m',
          serialNumber: '',
        },
        lineItems: [
          {
            kind: 'product',
            catalogProductId: target._id,
            name: 'USB-C Cable 1m',
            price: 120,
            quantity: 2,
          },
        ],
      },
      expect.anything(),
    );

    // 4. Target note and metadata consolidated
    expect(target.note).toBe('Target note\nSource note\nDraft note');
    expect(target.sourceTags).toEqual(['manual', 'order-card']);
    expect(target.save).toHaveBeenCalled();

    // 5. Source deleted
    expect(catalogFindByIdAndDelete).toHaveBeenCalledWith(
      sourceProductId,
      expect.anything(),
    );

    expect(result.removedCatalogProductId).toBe(sourceProductId);
    expect(result.relinkedSalesCount).toBe(1);
    expect(result.relinkedSupplierOrdersCount).toBe(1);
    expect(result.relinkedStockProductsCount).toBe(1);
  });
});
