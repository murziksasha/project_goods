import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { WarehouseItem } from '../../../entities/warehouse-settings/model/types';
import {
  aggregateProductModelStock,
  buildProductModelSavePayload,
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

  it('maps modal price fields to the model update payload', () => {
    expect(
      buildProductModelSavePayload('Mi Box S Gen 3', {
        article: 'A2',
        note: 'new note',
        retailPrice: '170',
        wholesalePrice: '160',
        purchasePrice: '120',
      }),
    ).toEqual({
      name: 'Mi Box S Gen 3',
      article: 'A2',
      note: 'new note',
      retailPrice: '170',
      wholesalePrice: '160',
      purchasePrice: '120',
    });
  });
});
