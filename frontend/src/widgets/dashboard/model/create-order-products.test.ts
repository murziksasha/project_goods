import { describe, expect, it } from 'vitest';
import type { CatalogProduct } from '../../../entities/catalog-product/model/types';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  buildCreateOrderProductSuggestions,
  buildCreateOrderSaleLineItems,
} from './create-order-products';

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

const catalogProduct = (
  patch: Partial<CatalogProduct>,
): CatalogProduct => ({
  id: 'c1',
  name: 'iPhone case',
  note: 'Catalog product',
  isActive: true,
  sourceTags: [],
  lastSeenAt: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

describe('create order product helpers', () => {
  it('prioritizes exact serial stock matches', () => {
    const suggestions = buildCreateOrderProductSuggestions({
      products: [
        product({ id: 'p-name', name: 'S000003 adapter', serialNumber: 'A1' }),
        product({ id: 'p-serial', serialNumber: 'S000003' }),
      ],
      catalogProducts: [],
      sales: [],
      query: 'S000003',
    });

    expect(suggestions[0]).toMatchObject({
      source: 'stock',
      productId: 'p-serial',
      serialNumber: 'S000003',
      availabilityLabel: 'Free',
      selectable: true,
    });
  });

  it('returns stock article/name matches before catalog fallback', () => {
    const suggestions = buildCreateOrderProductSuggestions({
      products: [product({ id: 'p-article', article: 'HUB-USB' })],
      catalogProducts: [catalogProduct({ id: 'c-hub', name: 'USB hub' })],
      sales: [],
      query: 'hub',
    });

    expect(suggestions.map((item) => item.source)).toEqual([
      'stock',
      'catalog',
    ]);
    expect(suggestions[0].article).toBe('HUB-USB');
  });

  it('labels occupied and unavailable stock suggestions as blocked', () => {
    const sale = {
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
          serialNumbers: ['S000003'],
        },
      ],
    } as Pick<Sale, 'id' | 'product' | 'lineItems'>;

    const suggestions = buildCreateOrderProductSuggestions({
      products: [
        product({ id: 'occupied', serialNumber: 'S000003' }),
        product({
          id: 'empty',
          serialNumber: 'S000004',
          freeQuantity: 0,
          quantity: 0,
          isInStock: false,
        }),
      ],
      catalogProducts: [],
      sales: [sale],
      query: 'S00000',
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: 'occupied',
          availabilityLabel: 'Linked to another order',
          selectable: false,
        }),
        expect.objectContaining({
          productId: 'empty',
          availabilityLabel: 'No free stock',
          selectable: false,
        }),
      ]),
    );
  });

  it('maps create-order sale items to linked line items', () => {
    expect(
      buildCreateOrderSaleLineItems([
        {
          id: 'li-stock',
          productId: 'p1',
          name: 'iPhone 14',
          article: 'IPH-14',
          serialNumber: 'S000003',
          serialNumbers: ['S000003'],
          price: '1200',
          quantity: '1',
          warrantyPeriod: '12',
          warehouse: '',
        },
        {
          id: 'li-manual',
          productId: '',
          name: 'Manual item',
          article: '',
          serialNumber: '',
          price: '300',
          quantity: '2',
          warrantyPeriod: '0',
          warehouse: '',
        },
      ]),
    ).toEqual([
      {
        id: 'li-stock',
        kind: 'product',
        productId: 'p1',
        name: 'iPhone 14',
        price: 1200,
        quantity: 1,
        warrantyPeriod: 12,
        serialNumbers: ['S000003'],
      },
      {
        id: 'li-manual',
        kind: 'product',
        productId: undefined,
        name: 'Manual item',
        price: 300,
        quantity: 2,
        warrantyPeriod: 0,
        serialNumbers: [],
      },
    ]);
  });
});
