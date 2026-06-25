import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import {
  filterProductsByWarehouse,
  getActiveWarehouseOptions,
  getDefaultWarehouseId,
  productMatchesWarehouse,
} from './warehouse-serial-filter';

const warehouse = (patch: Partial<WarehouseItem> = {}): WarehouseItem => ({
  id: 'wh-main',
  name: 'Main warehouse',
  isActive: true,
  serviceCenterId: 'sc-1',
  receiptAddress: '',
  receiptPhone: '',
  locations: [{ id: 'loc-1', name: 'Shelf A' }],
  ...patch,
});

const product = (patch: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Cable',
  article: 'CBL',
  serialNumber: 'S000001',
  price: 100,
  salePriceOptions: [120],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'wh-main',
  locationId: 'loc-1',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('warehouse-serial-filter', () => {
  const warehouses = [
    warehouse({ id: 'wh-main', name: 'Main warehouse' }),
    warehouse({ id: 'wh-second', name: 'Second warehouse', isActive: true }),
    warehouse({ id: 'wh-old', name: 'Old warehouse', isActive: false }),
  ];

  it('returns first active warehouse as default', () => {
    expect(getDefaultWarehouseId(warehouses)).toBe('wh-main');
    expect(getDefaultWarehouseId([warehouse({ id: 'wh-old', isActive: false })])).toBe(
      'wh-old',
    );
  });

  it('returns active warehouse options only', () => {
    expect(getActiveWarehouseOptions(warehouses)).toEqual([
      { id: 'wh-main', name: 'Main warehouse' },
      { id: 'wh-second', name: 'Second warehouse' },
    ]);
  });

  it('matches products by warehouseId and purchasePlace fallback', () => {
    expect(
      productMatchesWarehouse(
        product({ warehouseId: 'wh-main' }),
        'wh-main',
        warehouses,
      ),
    ).toBe(true);
    expect(
      productMatchesWarehouse(
        product({ warehouseId: '', purchasePlace: 'Second warehouse' }),
        'wh-second',
        warehouses,
      ),
    ).toBe(true);
    expect(
      productMatchesWarehouse(
        product({ warehouseId: 'wh-second' }),
        'wh-main',
        warehouses,
      ),
    ).toBe(false);
  });

  it('filters products by selected warehouse', () => {
    const products = [
      product({ id: 'p-main', warehouseId: 'wh-main', serialNumber: 'S1' }),
      product({ id: 'p-second', warehouseId: 'wh-second', serialNumber: 'S2' }),
    ];

    expect(filterProductsByWarehouse(products, 'wh-main', warehouses)).toEqual([
      products[0],
    ]);
    expect(filterProductsByWarehouse(products, '', warehouses)).toEqual(products);
  });
});