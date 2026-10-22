import { describe, expect, it } from 'vitest';
import i18n from '../../../shared/i18n/config';
import type { CatalogProduct } from '../../../entities/catalog-product';
import type { Product } from '../../../entities/product';
import type { Sale } from '../../../entities/sale';
import {
  buildOrderDetailProductSuggestions,
  collectOrderDetailCandidateSerials,
} from './create-order-products';

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

  it('omits a serial that is occupied outside the loaded sales page', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({
          id: 'missing',
          serialNumber: 'S000140',
          quantity: 1,
          freeQuantity: 1,
          isInStock: true,
        }),
        product({ id: 'free', serialNumber: 'S000138' }),
      ],
      catalogProducts: [],
      sales: [],
      query: 'S0001',
      warehouses,
      occupiedSerialNumbers: ['S000140'],
    });

    expect(suggestions.map((item) => item.productId)).toEqual(['free']);
  });

  it('omits an issued unit that still has free quantity', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({
          id: 'issued-unit',
          serialNumber: 'S000140',
          quantity: 1,
          freeQuantity: 1,
          isInStock: true,
        }),
      ],
      catalogProducts: [],
      sales: [
        {
          id: 'sale-issued',
          status: 'issued',
          product: {
            id: 'issued-unit',
            article: '',
            name: '',
            serialNumber: 'DEVICE-1',
          },
          lineItems: [],
        } as Pick<Sale, 'id' | 'status' | 'product' | 'lineItems'>,
      ],
      query: 'S000140',
      warehouses,
    });

    expect(suggestions).toEqual([]);
  });

  it('omits a unit with no warehouse quantity even when free quantity is positive', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({
          id: 'empty',
          serialNumber: 'S000140',
          quantity: 0,
          freeQuantity: 1,
          isInStock: true,
        }),
      ],
      catalogProducts: [catalogProduct({ name: 'S000140 catalog' })],
      sales: [],
      query: 'S000140',
      warehouses,
    });

    expect(suggestions).toEqual([]);
  });

  it('drops serialized rows when occupancy is unavailable and keeps a no-serial article match', () => {
    const suggestions = buildOrderDetailProductSuggestions({
      products: [
        product({
          id: 'serial',
          serialNumber: 'S000140',
          article: 'HUB-1',
        }),
        product({
          id: 'bulk',
          serialNumber: '',
          article: 'HUB-2',
        }),
      ],
      catalogProducts: [],
      sales: [],
      query: 'hub',
      warehouses,
      occupancyUnavailable: true,
    });

    expect(suggestions.map((item) => item.productId)).toEqual(['bulk']);
  });

  it('collects in-stock serials for the query and for catalog name matches', () => {
    expect(
      collectOrderDetailCandidateSerials({
        products: [
          product({ id: 'typed', serialNumber: 'S000140' }),
          product({
            id: 'named',
            name: 'SVOD Decalcification',
            serialNumber: 'S000141',
            article: 'OTHER',
          }),
          product({
            id: 'gone',
            serialNumber: 'S000142',
            quantity: 0,
          }),
        ],
        catalogProducts: [
          catalogProduct({
            id: 'c-svod',
            name: 'SVOD Decalcification',
          }),
        ],
        query: 'svod',
      }),
    ).toEqual(['S000141']);

    expect(
      collectOrderDetailCandidateSerials({
        products: [product({ serialNumber: 'S000140' })],
        catalogProducts: [],
        query: 'S000140',
      }),
    ).toEqual(['S000140']);

    expect(
      collectOrderDetailCandidateSerials({
        products: [product({ serialNumber: 'S000140' })],
        catalogProducts: [],
        query: 's',
      }),
    ).toEqual([]);
  });

  it('returns sorted top 8 when more than 8 catalog matches exist and array order differs from sortOrder', () => {
    const catalogMatches = [
      catalogProduct({ id: 'c-9', name: 'Cable J', sortOrder: 9 }),
      catalogProduct({ id: 'c-8', name: 'Cable I', sortOrder: 8 }),
      catalogProduct({ id: 'c-7', name: 'Cable H', sortOrder: 7 }),
      catalogProduct({ id: 'c-6', name: 'Cable G', sortOrder: 6 }),
      catalogProduct({ id: 'c-5', name: 'Cable F', sortOrder: 5 }),
      catalogProduct({ id: 'c-4', name: 'Cable E', sortOrder: 4 }),
      catalogProduct({ id: 'c-3', name: 'Cable D', sortOrder: 3 }),
      catalogProduct({ id: 'c-2', name: 'Cable C', sortOrder: 2 }),
      catalogProduct({ id: 'c-1', name: 'Cable B', sortOrder: 1 }),
      catalogProduct({ id: 'c-0', name: 'Cable A', sortOrder: 0 }),
    ];

    const suggestions = buildOrderDetailProductSuggestions({
      products: [],
      catalogProducts: catalogMatches,
      sales: [],
      query: 'Cable',
      warehouses,
    });

    expect(suggestions).toHaveLength(8);
    expect(suggestions.map((s) => s.name)).toEqual([
      'Cable A',
      'Cable B',
      'Cable C',
      'Cable D',
      'Cable E',
      'Cable F',
      'Cable G',
      'Cable H',
    ]);
    expect(suggestions.map((s) => s.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});