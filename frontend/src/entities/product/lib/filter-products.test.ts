import { describe, expect, it } from 'vitest';
import { filterProducts } from './filter-products';
import type { Product } from '../model/types';

const products: Product[] = [
  {
    id: '1',
    name: 'Keyboard',
    article: 'KB-01',
    serialNumber: 'SN-KEY',
    price: 1000,
    salePriceOptions: [1100],
    note: 'Mechanical',
    quantity: 5,
    reservedQuantity: 1,
    freeQuantity: 4,
    isInStock: true,
    purchasePlace: 'Main store',
    purchaseDate: null,
    warrantyPeriod: 12,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Mouse',
    article: 'MS-02',
    serialNumber: 'SN-MOUSE',
    price: 800,
    salePriceOptions: [900],
    note: 'Wireless',
    quantity: 3,
    reservedQuantity: 0,
    freeQuantity: 3,
    isInStock: true,
    purchasePlace: 'Warehouse',
    purchaseDate: null,
    warrantyPeriod: 12,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('filterProducts', () => {
  it('returns all products for empty query', () => {
    expect(filterProducts(products, '')).toHaveLength(2);
  });

  it('finds products by normalized text query', () => {
    const result = filterProducts(products, 'wireless');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('2');
  });

  it('searches across article and serial number', () => {
    expect(filterProducts(products, 'kb-01')).toHaveLength(1);
    expect(filterProducts(products, 'sn-mouse')).toHaveLength(1);
  });
});
