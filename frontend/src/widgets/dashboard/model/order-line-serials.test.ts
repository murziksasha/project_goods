import { describe, expect, it } from 'vitest';
import type { Product } from '../../../entities/product/model/types';
import type { Sale } from '../../../entities/sale/model/types';
import {
  buildInMemorySerialUsageSale,
  buildSerializedProductLineItem,
  getProductSerialAvailability,
  getSaleSerialUsage,
} from './order-line-serials';

const product: Product = {
  id: 'p1',
  name: 'Cable Trigger',
  article: 'CBL',
  serialNumber: ' s000020 ',
  price: 300,
  salePriceOptions: [500],
  note: '',
  quantity: 1,
  reservedQuantity: 0,
  freeQuantity: 1,
  isInStock: true,
  purchasePlace: '',
  warehouseId: '',
  locationId: '',
  purchaseDate: null,
  warrantyPeriod: 0,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const sale = {
  id: 'sale-1',
  product: { serialNumber: '' },
  lineItems: [
    {
      id: 'li-1',
      kind: 'product',
      name: 'Cable Trigger',
      price: 500,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000020'],
    },
  ],
} as Pick<Sale, 'id' | 'product' | 'lineItems'>;

describe('order line serial helpers', () => {
  it('marks serials already bound to the current sale as unavailable', () => {
    const usage = getSaleSerialUsage([sale], 'sale-1');

    expect(getProductSerialAvailability(product, usage)).toEqual({
      labelKey: 'orders.serialAvailability.alreadyInThisOrder',
      selectable: false,
    });
  });

  it('builds in-memory serial usage sale for draft occupancy', () => {
    expect(buildInMemorySerialUsageSale([' s000020 ', 'S000020', 'S000021'])).toEqual({
      id: '',
      product: { id: '', article: '', name: '', serialNumber: '' },
      lineItems: [
        expect.objectContaining({ serialNumbers: ['S000020'] }),
        expect.objectContaining({ serialNumbers: ['S000021'] }),
      ],
    });
  });

  it('builds atomic serialized product line items', () => {
    expect(
      buildSerializedProductLineItem({
        product,
        price: 500,
        warrantyPeriod: 0,
      }),
    ).toEqual({
      kind: 'product',
      productId: 'p1',
      name: 'Cable Trigger',
      price: 500,
      quantity: 1,
      warrantyPeriod: 0,
      serialNumbers: ['S000020'],
    });
  });
});
