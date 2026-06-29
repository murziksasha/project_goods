import { describe, expect, it } from 'vitest';
import i18n from '../../../shared/i18n/config';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import { buildOrderDetailProductSuggestions } from './create-order-products';

const warehouses = [
  {
    id: 'wh-main',
    name: 'Main warehouse',
    isActive: true,
    locations: [{ id: 'loc-1', name: 'Shelf A' }],
  },
  {
    id: 'wh-second',
    name: 'Second warehouse',
    isActive: true,
    locations: [{ id: 'loc-2', name: 'Shelf B' }],
  },
];

const product = (patch: Partial<Product>): Product => ({
  id: 'p1',
  name: 'iPhone 14',
  article: 'IPH-14',
  serialNumber: 'S000003',
  price: 1000,
  salePriceOptions: [1200],
  note: 'Stock note match',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'wh-main',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 12,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const catalogProduct = (
  patch: Partial<CatalogProduct>,
): CatalogProduct => ({
  id: 'c1',
  name: 'iPhone 14',
  note: 'Catalog note match',
  isActive: true,
  sourceTags: [],
  lastSeenAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('buildOrderDetailProductSuggestions', () => {
  it('ignores stock and catalog note fields', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [product({ note: 'unique-stock-note-token' })],
      catalogProducts: [
        catalogProduct({ name: 'Other item', note: 'unique-catalog-note-token' }),
      ],
      sales: [],
      query: 'unique-note',
      warehouses,
    });

    expect(suggestions).toEqual([]);
  });

  it('returns catalog matches by name only when query does not match serial or article', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [product({ id: 'stock-1', name: 'TerraE battery' })],
      catalogProducts: [catalogProduct({ id: 'c-terra', name: 'TerraE battery' })],
      sales: [],
      query: 'TerraE',
      warehouses,
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        source: 'catalog',
        catalogProductId: 'c-terra',
      }),
    ]);
    expect(suggestions.some((item) => item.source === 'stock')).toBe(false);
  });

  it('returns stock matches by article without catalog fallback', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [product({ id: 'p-article', article: 'HUB-USB' })],
      catalogProducts: [catalogProduct({ id: 'c-hub', name: 'USB hub' })],
      sales: [],
      query: 'hub',
      warehouses,
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        source: 'stock',
        productId: 'p-article',
        article: 'HUB-USB',
        warehouseName: 'Main warehouse',
      }),
    ]);
  });

  it('returns stock matches by serial with warehouse name', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({ id: 'p-serial', serialNumber: 'S000003', warehouseId: 'wh-second' }),
      ],
      catalogProducts: [],
      sales: [],
      query: 'S000003',
      warehouses,
    });

    expect(suggestions[0]).toMatchObject({
      source: 'stock',
      productId: 'p-serial',
      serialNumber: 'S000003',
      warehouseName: 'Second warehouse',
      availabilityLabel: i18n.t('orders.serialAvailability.free'),
      selectable: true,
    });
  });

  it('excludes unavailable stock suggestions in stock mode', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({ id: 'occupied', serialNumber: 'S000004', freeQuantity: 0, isInStock: false }),
        product({ id: 'free', serialNumber: 'S000007' }),
      ],
      catalogProducts: [],
      sales: [
        {
          id: 'sale-1',
          product: { id: '', article: '', name: '', serialNumber: '' },
          lineItems: [
            {
              id: 'li-1',
              kind: 'product',
              name: 'iPhone 14',
              price: 1200,
              quantity: 1,
              warrantyPeriod: 12,
              serialNumbers: ['S000004'],
            },
          ],
        } as Pick<Sale, 'id' | 'product' | 'lineItems'>,
      ],
      query: 'S00000',
      warehouses,
    });

    expect(suggestions.map((item) => item.productId)).toEqual(['free']);
  });
});