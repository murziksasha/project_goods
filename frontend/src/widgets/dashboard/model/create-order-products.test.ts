import { describe, expect, it } from 'vitest';
import i18n from '../../../shared/i18n/config';
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
      availabilityLabel: i18n.t('orders.serialAvailability.free'),
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

  it('excludes occupied and unavailable stock suggestions', () => {
    const currentSale = {
      id: '',
      product: { id: '', article: '', name: '', serialNumber: '' },
      lineItems: [
        {
          id: 'li-current',
          kind: 'product',
          name: 'iPhone 14',
          price: 1200,
          quantity: 1,
          warrantyPeriod: 12,
          serialNumbers: ['S000003'],
        },
      ],
    } as Pick<Sale, 'id' | 'product' | 'lineItems'>;
    const otherSale = {
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
    } as Pick<Sale, 'id' | 'product' | 'lineItems'>;

    const suggestions = buildCreateOrderProductSuggestions({
      products: [
        product({ id: 'current', serialNumber: 'S000003' }),
        product({ id: 'occupied', serialNumber: 'S000004' }),
        product({
          id: 'empty',
          serialNumber: 'S000005',
          freeQuantity: 0,
          quantity: 0,
          isInStock: false,
        }),
        product({ id: 'inactive', serialNumber: 'S000006', isActive: false }),
        product({ id: 'free', serialNumber: 'S000007' }),
      ],
      catalogProducts: [],
      sales: [currentSale, otherSale],
      query: 'S00000',
    });

    expect(suggestions.map((item) => item.productId)).toEqual(['free']);
    expect(suggestions[0]).toMatchObject({
      availabilityLabel: i18n.t('orders.serialAvailability.free'),
      selectable: true,
    });
  });

  it('hides catalog fallback that duplicates an unavailable stock model', () => {
    const sale = {
      id: 'sale-1',
      product: { id: '', article: '', name: '', serialNumber: '' },
      lineItems: [
        {
          id: 'li-1',
          kind: 'product',
          name: 'USB hub',
          price: 1200,
          quantity: 1,
          warrantyPeriod: 12,
          serialNumbers: ['HUB-001'],
        },
      ],
    } as Pick<Sale, 'id' | 'product' | 'lineItems'>;

    const suggestions = buildCreateOrderProductSuggestions({
      products: [
        product({
          id: 'occupied',
          name: 'USB hub',
          serialNumber: 'HUB-001',
        }),
      ],
      catalogProducts: [catalogProduct({ id: 'c-hub', name: 'USB hub' })],
      sales: [sale],
      query: 'hub',
    });

    expect(suggestions).toEqual([]);
  });

  it('keeps catalog fallback for catalog-only products', () => {
    const suggestions = buildCreateOrderProductSuggestions({
      products: [],
      catalogProducts: [catalogProduct({ id: 'c-hub', name: 'USB hub' })],
      sales: [],
      query: 'hub',
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        source: 'catalog',
        catalogProductId: 'c-hub',
        selectable: true,
      }),
    ]);
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
          catalogProductId: '',
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
        catalogProductId: undefined,
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
        catalogProductId: undefined,
        name: 'Manual item',
        price: 300,
        quantity: 2,
        warrantyPeriod: 0,
        serialNumbers: [],
      },
    ]);
  });

  it('keeps catalog product ids separate from stock product ids', () => {
    expect(
      buildCreateOrderSaleLineItems([
        {
          id: 'li-catalog',
          productId: '',
          catalogProductId: 'c-hub',
          name: 'USB hub',
          article: '',
          serialNumber: '',
          price: '400',
          quantity: '1',
          warrantyPeriod: '0',
          warehouse: '',
        },
        {
          id: 'li-stock',
          productId: 'p1',
          catalogProductId: '',
          name: 'iPhone 14',
          article: 'IPH-14',
          serialNumber: 'S000003',
          serialNumbers: ['S000003'],
          price: '1200',
          quantity: '1',
          warrantyPeriod: '12',
          warehouse: '',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'li-catalog',
        productId: undefined,
        catalogProductId: 'c-hub',
      }),
      expect.objectContaining({
        id: 'li-stock',
        productId: 'p1',
        catalogProductId: undefined,
        serialNumbers: ['S000003'],
      }),
    ]);
  });
});
