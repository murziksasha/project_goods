import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product';
import {
  buildRapidSaleLineItems,
  buildRapidSaleStockSuggestions,
  getRapidSaleDraftTotal,
  validateRapidSaleDraft,
  type RapidSaleDraftItem,
} from './rapid-sale-line-items';

const product = (patch: Partial<Product>): Product => ({
  id: 'p1',
  name: 'iPhone 14',
  article: 'IPH-14',
  serialNumber: 'S000003',
  price: 1000,
  salePriceOptions: [1200],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: '',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 12,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('rapid-sale-line-items', () => {
  it('returns only selectable stock suggestions', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({ id: 'stock-1', name: 'Cable', freeQuantity: 1 }),
        product({ id: 'stock-2', name: 'Cable Pro', freeQuantity: 0, quantity: 0 }),
      ],
      sales: [],
      query: 'cable',
    });

    expect(suggestions.every((item) => item.source === 'stock')).toBe(true);
    expect(suggestions.some((item) => item.name === 'Cable')).toBe(true);
    expect(suggestions.some((item) => item.name === 'Cable Pro')).toBe(false);
  });

  it('builds mixed product and service line items', () => {
    const items: RapidSaleDraftItem[] = [
      {
        id: 'p1',
        kind: 'product',
        productId: 'stock-1',
        name: 'Cable',
        price: '100',
        quantity: '2',
        warrantyPeriod: '0',
      },
      {
        id: 's1',
        kind: 'service',
        serviceId: 'svc-1',
        name: 'Setup',
        price: '50',
        quantity: '1',
        warrantyPeriod: '1',
      },
    ];

    expect(buildRapidSaleLineItems(items)).toEqual([
      expect.objectContaining({
        kind: 'product',
        productId: 'stock-1',
        quantity: 2,
        price: 100,
      }),
      expect.objectContaining({
        kind: 'service',
        serviceId: 'svc-1',
        quantity: 1,
        price: 50,
      }),
    ]);
    expect(getRapidSaleDraftTotal(items)).toBe(250);
  });

  it('excludes serials already present in draft items', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({ id: 'stock-1', serialNumber: 'S000003' }),
        product({ id: 'stock-2', serialNumber: 'S000004' }),
      ],
      sales: [],
      query: 'S00000',
      draftItems: [
        {
          id: 'draft-1',
          kind: 'product',
          productId: 'stock-1',
          name: 'iPhone 14',
          price: '1000',
          quantity: '1',
          warrantyPeriod: '12',
          serialNumbers: ['S000003'],
        },
      ],
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual(['S000004']);
  });

  it('excludes serials selected in the pending entry row', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({ id: 'stock-1', serialNumber: 'S000003' }),
        product({ id: 'stock-2', serialNumber: 'S000004' }),
      ],
      sales: [],
      query: 'S00000',
      pendingSerialNumbers: ['S000004'],
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual(['S000003']);
  });

  it('lists the older receipt above the newer one before the limit', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({
          id: 'newer',
          name: 'Fluid',
          serialNumber: 'S000140',
          purchaseDate: '2026-03-01T00:00:00.000Z',
          createdAt: '2026-03-01T00:00:00.000Z',
        }),
        product({
          id: 'older',
          name: 'Fluid',
          serialNumber: 'S000138',
          purchaseDate: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        }),
      ],
      sales: [],
      query: 'fluid',
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual([
      'S000138',
      'S000140',
    ]);
  });

  it('keeps the oldest matches when more than the limit are in stock', () => {
    const products = Array.from({ length: 9 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return product({
        id: `unit-${index + 1}`,
        name: 'Fluid',
        serialNumber: `S00010${index + 1}`,
        purchaseDate: `2026-02-${day}T00:00:00.000Z`,
        createdAt: `2026-02-${day}T00:00:00.000Z`,
      });
    }).reverse();

    const suggestions = buildRapidSaleStockSuggestions({
      products,
      sales: [],
      query: 'fluid',
      limit: 8,
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual([
      'S000101',
      'S000102',
      'S000103',
      'S000104',
      'S000105',
      'S000106',
      'S000107',
      'S000108',
    ]);
  });

  it('keeps manual name order ahead of receipt age', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({
          id: 'older-name',
          name: 'Unit Alpha',
          sortOrder: 1,
          serialNumber: 'S000100',
          purchaseDate: '2026-01-01T00:00:00.000Z',
        }),
        product({
          id: 'newer-name',
          name: 'Unit Zebra',
          sortOrder: 0,
          serialNumber: 'S000200',
          purchaseDate: '2026-06-01T00:00:00.000Z',
        }),
      ],
      sales: [],
      query: 'unit',
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual([
      'S000200',
      'S000100',
    ]);
  });

  it('omits a serial occupied on a sale that is not in the loaded sales page', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({
          id: 'bound',
          name: 'Fluid',
          serialNumber: 'S000140',
          purchaseDate: '2026-03-01T00:00:00.000Z',
        }),
        product({
          id: 'free',
          name: 'Fluid',
          serialNumber: 'S000138',
          purchaseDate: '2026-01-01T00:00:00.000Z',
        }),
      ],
      sales: [],
      occupiedSerialNumbers: ['s000140'],
      query: 'fluid',
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual(['S000138']);
  });

  it('omits a unit linked to an issued sale even when quantity is still positive', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({
          id: 'sold',
          name: 'Fluid',
          serialNumber: 'S000140',
          quantity: 1,
          freeQuantity: 1,
          isInStock: true,
        }),
        product({
          id: 'free',
          name: 'Fluid',
          serialNumber: 'S000138',
        }),
      ],
      sales: [
        {
          id: 'sale-issued',
          status: 'issued',
          product: { id: '', article: '', name: '', serialNumber: '' },
          lineItems: [
            {
              id: 'li-1',
              kind: 'product',
              productId: 'sold',
              name: 'Fluid',
              price: 10,
              quantity: 1,
              warrantyPeriod: 0,
              serialNumbers: ['S000140'],
            },
          ],
        },
      ],
      query: 'fluid',
    });

    expect(suggestions.map((item) => item.serialNumber)).toEqual(['S000138']);
  });

  it('drops serialized rows when occupancy cannot be loaded and keeps bulk stock', () => {
    const suggestions = buildRapidSaleStockSuggestions({
      products: [
        product({
          id: 'serial',
          name: 'Fluid',
          serialNumber: 'S000138',
        }),
        product({
          id: 'bulk',
          name: 'Fluid bulk',
          serialNumber: '',
          quantity: 4,
          freeQuantity: 4,
        }),
      ],
      sales: [],
      occupancyUnavailable: true,
      query: 'fluid',
    });

    expect(suggestions.map((item) => item.productId)).toEqual(['bulk']);
  });

  it('validates draft requirements', () => {
    expect(validateRapidSaleDraft([])).toBe('orders.rapidSale.errors.noItems');
    expect(
      validateRapidSaleDraft([
        {
          id: 'p1',
          kind: 'product',
          productId: '',
          name: 'Manual',
          price: '10',
          quantity: '1',
          warrantyPeriod: '0',
        },
      ]),
    ).toBe('orders.rapidSale.errors.stockOnly');
    expect(
      validateRapidSaleDraft([
        {
          id: 's1',
          kind: 'service',
          name: 'Setup',
          price: '10',
          quantity: '1',
          warrantyPeriod: '1',
        },
      ]),
    ).toBeNull();
    expect(
      validateRapidSaleDraft([
        {
          id: 'p1',
          kind: 'product',
          productId: 'stock-1',
          name: 'iPhone 14',
          price: '1000',
          quantity: '1',
          warrantyPeriod: '12',
          serialNumbers: ['S000003'],
        },
        {
          id: 'p2',
          kind: 'product',
          productId: 'stock-1',
          name: 'iPhone 14',
          price: '1000',
          quantity: '1',
          warrantyPeriod: '12',
          serialNumbers: ['S000003'],
        },
      ]),
    ).toBe('orders.rapidSale.errors.duplicateSerial');
  });
});