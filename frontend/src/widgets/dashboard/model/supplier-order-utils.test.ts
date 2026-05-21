import { describe, expect, it } from 'vitest';
import type { SupplierOrder } from '../../../entities/supplier-order/model/types';
import type { Supplier } from '../../../entities/supplier/model/types';
import {
  buildSupplierOrderItemNumber,
  getSupplierSuggestions,
  mergeSupplierOrderItemUpdate,
} from './supplier-order-utils';

const makeOrder = (): SupplierOrder => ({
  id: 'so-1',
  orderBaseId: 'SO-1779142808517',
  supplierId: 'sup-1',
  supplierName: 'Supplier',
  deliveryDate: '2026-05-19',
  supplyType: 'local',
  number: 'SO-1779142808517',
  note: '',
  createdBy: 'Admin',
  status: 'approved',
  paymentStatus: 'pending',
  receiptStatus: 'new',
  total: 9500,
  paid: 9500,
  items: [
    {
      lineId: 'line-1',
      itemIndex: 0,
      catalogProductId: 'cat-1',
      productName: 'Type C cable',
      quantity: 50,
      price: 100,
    },
    {
      lineId: 'line-2',
      itemIndex: 1,
      catalogProductId: 'cat-2',
      productName: 'Router TP-Link',
      quantity: 5,
      price: 900,
    },
  ],
  createdAt: '2026-05-19T00:00:00.000Z',
  updatedAt: '2026-05-19T00:00:00.000Z',
});

describe('supplier-order-utils', () => {
  it('builds supplier order number with item postfix', () => {
    const order = makeOrder();
    expect(buildSupplierOrderItemNumber(order, 0)).toBe(
      'SO-1779142808517-1',
    );
    expect(buildSupplierOrderItemNumber(order, 1)).toBe(
      'SO-1779142808517-2',
    );
  });

  it('updates only selected item and keeps others unchanged', () => {
    const order = makeOrder();
    const merged = mergeSupplierOrderItemUpdate({
      sourceOrder: order,
      selectedItemIndex: 1,
      updatedItem: {
        lineId: 'line-updated',
        itemIndex: 0,
        catalogProductId: 'cat-2',
        productName: 'Router TP-Link WR741',
        quantity: 7,
        price: 950,
      },
    });

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(order.items[0]);
    expect(merged[1]).toMatchObject({
      lineId: 'line-updated',
      itemIndex: 1,
      catalogProductId: 'cat-2',
      productName: 'Router TP-Link WR741',
      quantity: 7,
      price: 950,
    });
  });

  it('returns active supplier suggestions by name or phone', () => {
    const suppliers: Supplier[] = [
      {
        id: '1',
        name: 'Remont Service',
        phone: '+3801111111',
        note: '',
        supplierOrder: '',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        name: 'Inactive Supplier',
        phone: '+3802222222',
        note: '',
        supplierOrder: '',
        isActive: false,
        createdAt: '',
        updatedAt: '',
      },
    ];

    expect(getSupplierSuggestions(suppliers, 're')).toHaveLength(1);
    expect(getSupplierSuggestions(suppliers, '11')[0]?.id).toBe('1');
    expect(getSupplierSuggestions(suppliers, 'i')).toHaveLength(0);
  });
});
