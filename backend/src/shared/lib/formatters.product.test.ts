import { describe, expect, it } from 'vitest';
import { formatProduct } from './formatters';

describe('formatProduct', () => {
  it('returns supplier order provenance fields', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const updatedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(
      formatProduct({
        _id: { toString: () => 'product-1' },
        name: 'Patchcord 1m',
        article: 'A-1',
        serialNumber: 'S000001',
        price: 35,
        salePriceOptions: [],
        note: '',
        quantity: 1,
        reservedQuantity: 0,
        purchasePlace: 'Main',
        warehouseId: 'w-1',
        locationId: 'l-1',
        supplierOrderId: 'supplier-order-1',
        supplierOrderItemIndex: 0,
        purchaseDate: createdAt,
        warrantyPeriod: 0,
        isActive: true,
        createdAt,
        updatedAt,
      } as never),
    ).toMatchObject({
      supplierOrderId: 'supplier-order-1',
      supplierOrderItemIndex: 0,
    });
  });
});
