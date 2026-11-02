import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import { getStockModelGroupId } from './stock-balance';
import {
  classifyTransferProducts,
  getActiveBatchProducts,
  getSerialPreview,
  getVisibleCheckedGroupProducts,
  partitionDeleteProducts,
} from './warehouse-batch-actions';

const makeProduct = (patch: Partial<Product> = {}): Product => ({
  id: 'p-1',
  name: 'TerraE 30E',
  article: 'INR18650',
  serialNumber: 'S001',
  price: 10,
  salePriceOptions: [],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: 'Supplier',
  purchaseDate: '2026-01-01',
  warrantyPeriod: 12,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('getVisibleCheckedGroupProducts', () => {
  it('returns only checked members from the visible group products', () => {
    const p1 = makeProduct({ id: 'p-1' });
    const p2 = makeProduct({ id: 'p-2' });
    const p3 = makeProduct({ id: 'p-3' });

    expect(
      getVisibleCheckedGroupProducts([p1, p2, p3], ['p-1', 'p-3', 'other-id']),
    ).toEqual([p1, p3]);

    expect(getVisibleCheckedGroupProducts([p1, p2], [])).toEqual([]);
  });
});

describe('classifyTransferProducts', () => {
  it('returns all as movers if target warehouse or location is not selected', () => {
    const p1 = makeProduct({ id: 'p-1' });
    const meta = {
      'p-1': {
        warehouseId: 'w-1',
        warehouseName: 'Main',
        locationId: 'l-1',
        locationName: 'Shelf 1',
      },
    };

    expect(classifyTransferProducts([p1], meta, '', '')).toEqual({
      movers: [p1],
      stays: [],
    });

    expect(classifyTransferProducts([p1], meta, 'w-1', '')).toEqual({
      movers: [p1],
      stays: [],
    });
  });

  it('classifies units already at target as stays and others as movers', () => {
    const p1 = makeProduct({ id: 'p-1' });
    const p2 = makeProduct({ id: 'p-2' });
    const p3 = makeProduct({ id: 'p-3' });
    const meta = {
      'p-1': {
        warehouseId: 'w-1',
        warehouseName: 'Main',
        locationId: 'l-1',
        locationName: 'Shelf 1',
      },
      'p-2': {
        warehouseId: 'w-2',
        warehouseName: 'Shop',
        locationId: 'l-2',
        locationName: 'Shelf 2',
      },
    };

    const result = classifyTransferProducts([p1, p2, p3], meta, 'w-1', 'l-1');
    expect(result.stays).toEqual([p1]);
    expect(result.movers).toEqual([p2, p3]);
  });
});

describe('partitionDeleteProducts', () => {
  it('partitions products into deletable and blocked by linked sales', () => {
    const p1 = makeProduct({ id: 'p-1' });
    const p2 = makeProduct({ id: 'p-2' });
    const p3 = makeProduct({ id: 'p-3' });

    const salesByProductId: Record<string, Sale[]> = {
      'p-2': [{ id: 'sale-1' } as Sale],
    };

    const result = partitionDeleteProducts([p1, p2, p3], salesByProductId);
    expect(result.deletable).toEqual([p1, p3]);
    expect(result.blocked).toEqual([p2]);
  });
});

describe('getSerialPreview', () => {
  it('returns all serials when count is at or below maximum', () => {
    const products = [
      makeProduct({ id: 'p-1', serialNumber: 'SN-1' }),
      makeProduct({ id: 'p-2', serialNumber: 'SN-2' }),
    ];
    const preview = getSerialPreview(products, 10);
    expect(preview.visibleSerials).toEqual(['SN-1', 'SN-2']);
    expect(preview.remainderCount).toBe(0);
  });

  it('caps at maxVisible and calculates remainderCount', () => {
    const products = Array.from({ length: 14 }, (_, i) =>
      makeProduct({ id: `p-${i + 1}`, serialNumber: `SN-${i + 1}` }),
    );
    const preview = getSerialPreview(products, 10);
    expect(preview.visibleSerials).toHaveLength(10);
    expect(preview.visibleSerials[0]).toBe('SN-1');
    expect(preview.visibleSerials[9]).toBe('SN-10');
    expect(preview.remainderCount).toBe(4);
  });

  it('falls back to product id when serialNumber is missing or blank', () => {
    const products = [makeProduct({ id: 'p-empty', serialNumber: '   ' })];
    const preview = getSerialPreview(products);
    expect(preview.visibleSerials).toEqual(['p-empty']);
  });
});

describe('getActiveBatchProducts', () => {
  it('returns empty when no batch mode is active', () => {
    const result = getActiveBatchProducts(null, [], [], []);
    expect(result).toEqual({
      activeProducts: [],
      totalBatchUnitsCount: 0,
      isMerelyHidden: false,
    });
  });

  it('resolves live group batch units and handles filtered-out hidden state', () => {
    const p1 = makeProduct({ id: 'p-1', name: 'Model A', article: 'Art A' });
    const p2 = makeProduct({ id: 'p-2', name: 'Model A', article: 'Art A' });
    const pOther = makeProduct({ id: 'p-3', name: 'Model B', article: 'Art B' });
    const groupId = getStockModelGroupId(p1);

    const allProducts = [p1, p2, pOther];
    const selectedIds = ['p-1', 'p-2', 'p-3'];

    const result1 = getActiveBatchProducts(
      { type: 'group', groupId },
      allProducts,
      [p1, p2, pOther],
      selectedIds,
    );
    expect(result1.activeProducts).toEqual([p1, p2]);
    expect(result1.totalBatchUnitsCount).toBe(2);
    expect(result1.isMerelyHidden).toBe(false);

    const result2 = getActiveBatchProducts(
      { type: 'group', groupId },
      allProducts,
      [p1],
      selectedIds,
    );
    expect(result2.activeProducts).toEqual([p1]);
    expect(result2.totalBatchUnitsCount).toBe(2);
    expect(result2.isMerelyHidden).toBe(false);

    const result3 = getActiveBatchProducts(
      { type: 'group', groupId },
      allProducts,
      [pOther],
      selectedIds,
    );
    expect(result3.activeProducts).toEqual([]);
    expect(result3.totalBatchUnitsCount).toBe(2);
    expect(result3.isMerelyHidden).toBe(true);

    const result4 = getActiveBatchProducts(
      { type: 'group', groupId },
      allProducts,
      [p1, p2],
      ['p-3'],
    );
    expect(result4.activeProducts).toEqual([]);
    expect(result4.totalBatchUnitsCount).toBe(0);
    expect(result4.isMerelyHidden).toBe(false);
  });

  it('resolves unit batch and handles merely hidden vs deleted', () => {
    const p1 = makeProduct({ id: 'p-1' });
    const all = [p1];

    const res1 = getActiveBatchProducts(
      { type: 'unit', productId: 'p-1' },
      all,
      [p1],
      [],
    );
    expect(res1.activeProducts).toEqual([p1]);
    expect(res1.totalBatchUnitsCount).toBe(1);
    expect(res1.isMerelyHidden).toBe(false);

    const res2 = getActiveBatchProducts(
      { type: 'unit', productId: 'p-1' },
      all,
      [],
      [],
    );
    expect(res2.activeProducts).toEqual([]);
    expect(res2.totalBatchUnitsCount).toBe(1);
    expect(res2.isMerelyHidden).toBe(true);

    const res3 = getActiveBatchProducts(
      { type: 'unit', productId: 'p-1' },
      [],
      [],
      [],
    );
    expect(res3.activeProducts).toEqual([]);
    expect(res3.totalBatchUnitsCount).toBe(0);
    expect(res3.isMerelyHidden).toBe(false);
  });
});

