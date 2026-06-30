import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import type { StockSaleLink } from './stock-balance';
import {
  aggregateProductModelStock,
  buildProductModelSavePayload,
  buildProductModelSerialPurchases,
  getActiveStockProductsByExactModelName,
  getLatestBatchProduct,
  getProductsByExactModelName,
} from './product-model';

const baseProduct: Product = {
  id: 'p1',
  name: 'Mi Box S Gen 3',
  article: 'A1',
  serialNumber: 'S1',
  price: 100,
  salePriceOptions: [150, 140, 130],
  note: 'note',
  quantity: 2,
  reservedQuantity: 1,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: 'w1',
  locationId: 'l1',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const warehouses: WarehouseItem[] = [
  {
    id: 'w1',
    name: 'Main',
    isActive: true,
    serviceCenterId: 'sc1',
    receiptAddress: '',
    receiptPhone: '',
    locations: [{ id: 'l1', name: 'Shelf A' }],
  },
];

describe('product model aggregation', () => {
  it('matches products by exact normalized name and aggregates stock by warehouse', () => {
    const products = [
      baseProduct,
      {
        ...baseProduct,
        id: 'p2',
        serialNumber: 'S2',
        quantity: 3,
        reservedQuantity: 0,
        freeQuantity: 3,
      },
      {
        ...baseProduct,
        id: 'p3',
        name: 'Mi Box S Gen 3 Pro',
        serialNumber: 'S3',
      },
    ];

    const matching = getProductsByExactModelName(products, ' mi box s gen 3 ');
    const summary = aggregateProductModelStock(matching, warehouses);

    expect(matching).toHaveLength(2);
    expect(summary).toEqual([
      {
        warehouseId: 'w1',
        warehouseName: 'Main',
        locationId: 'l1',
        locationName: 'Shelf A',
        totalStock: 5,
        freeStock: 4,
        reservedStock: 1,
      },
    ]);
  });

  it('returns an empty read-only model when no stock rows match', () => {
    expect(getProductsByExactModelName([baseProduct], 'Missing')).toEqual([]);
    expect(aggregateProductModelStock([], warehouses)).toEqual([]);
  });

  it('excludes issued or zero-quantity units from active model stock rows', () => {
    const products = [
      {
        ...baseProduct,
        id: 'p-active',
        serialNumber: 'S-active',
        quantity: 1,
      },
      {
        ...baseProduct,
        id: 'p-sold',
        serialNumber: 'S-sold',
        quantity: 1,
      },
      {
        ...baseProduct,
        id: 'p-empty',
        serialNumber: 'S-empty',
        quantity: 0,
      },
    ];
    const sales: StockSaleLink[] = [
      {
        status: 'issued',
        product: { id: '', article: '', name: '', serialNumber: '' },
        lineItems: [
          {
            id: 'line-1',
            kind: 'product',
            productId: 'p-sold',
            name: 'Mi Box S Gen 3',
            price: 100,
            quantity: 1,
            warrantyPeriod: 0,
            serialNumbers: ['S-sold'],
          },
        ],
      },
    ];

    expect(
      getActiveStockProductsByExactModelName(
        products,
        sales,
        'Mi Box S Gen 3',
      ).map((product) => product.id),
    ).toEqual(['p-active']);
    expect(
      buildProductModelSerialPurchases(
        getActiveStockProductsByExactModelName(
          products,
          sales,
          'Mi Box S Gen 3',
        ),
      ).map((row) => row.serialNumber),
    ).toEqual(['S-active']);
  });

  it('builds per-serial purchase rows with latest batch markers', () => {
    const products = [
      {
        ...baseProduct,
        id: 'p-old-1',
        serialNumber: 'S001',
        price: 1000,
        purchaseDate: '2026-01-10',
        createdAt: '2026-01-10T10:00:00.000Z',
      },
      {
        ...baseProduct,
        id: 'p-old-2',
        serialNumber: 'S002',
        price: 1000,
        purchaseDate: '2026-01-10',
        createdAt: '2026-01-10T11:00:00.000Z',
      },
      {
        ...baseProduct,
        id: 'p-new-1',
        serialNumber: 'S004',
        price: 1200,
        purchaseDate: '2026-03-15',
        createdAt: '2026-03-15T09:00:00.000Z',
      },
      {
        ...baseProduct,
        id: 'p-new-2',
        serialNumber: 'S005',
        price: 1200,
        purchaseDate: '2026-03-15',
        createdAt: '2026-03-15T10:00:00.000Z',
      },
    ];

    expect(getLatestBatchProduct(products)?.id).toBe('p-new-2');
    expect(buildProductModelSerialPurchases(products)).toEqual([
      {
        productId: 'p-new-1',
        serialNumber: 'S004',
        price: 1200,
        purchaseDate: '2026-03-15',
        isLatestBatch: true,
      },
      {
        productId: 'p-new-2',
        serialNumber: 'S005',
        price: 1200,
        purchaseDate: '2026-03-15',
        isLatestBatch: true,
      },
      {
        productId: 'p-old-1',
        serialNumber: 'S001',
        price: 1000,
        purchaseDate: '2026-01-10',
        isLatestBatch: false,
      },
      {
        productId: 'p-old-2',
        serialNumber: 'S002',
        price: 1000,
        purchaseDate: '2026-01-10',
        isLatestBatch: false,
      },
    ]);
  });

  it('maps modal price fields to the model update payload without purchase price', () => {
    expect(
      buildProductModelSavePayload('Mi Box S Gen 3', {
        article: 'A2',
        note: 'new note',
        retailPrice: '170',
        wholesalePrice: '160',
      }),
    ).toEqual({
      name: 'Mi Box S Gen 3',
      article: 'A2',
      note: 'new note',
      retailPrice: '170',
      wholesalePrice: '160',
    });
  });
});
