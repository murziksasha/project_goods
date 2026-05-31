import { describe, expect, it } from 'vitest';
import {
  canRemoveLineItemAfterPayment,
  patchLineItemsById,
} from './line-item-ops';

type Item = {
  id: string;
  kind: 'product' | 'service';
  name: string;
  price: number;
  quantity: number;
  serialNumbers?: string[];
};

describe('patchLineItemsById', () => {
  it('updates only service by id and does not touch product with same filtered index', () => {
    const items: Item[] = [
      {
        id: 'product-1',
        kind: 'product',
        name: 'Mouse',
        price: 5,
        quantity: 1,
      },
      {
        id: 'service-1',
        kind: 'service',
        name: 'Diagnostics',
        price: 0,
        quantity: 1,
      },
      {
        id: 'service-2',
        kind: 'service',
        name: 'Repair',
        price: 0,
        quantity: 1,
      },
    ];

    // Simulates bug-prone call path from filtered services list where index=0.
    const nextItems = patchLineItemsById(items, 'service-1', 0, {
      price: 100,
    });

    expect(nextItems[0].price).toBe(5);
    expect(nextItems[1].price).toBe(100);
    expect(nextItems[2].price).toBe(0);
  });
});

describe('canRemoveLineItemAfterPayment', () => {
  const items: Item[] = [
    {
      id: 'product-1',
      kind: 'product',
      name: 'Aeromish G10S Pro',
      price: 275,
      quantity: 1,
    },
    {
      id: 'product-2',
      kind: 'product',
      name: 'Aeromish G10S Pro',
      price: 275,
      quantity: 1,
    },
    {
      id: 'product-3',
      kind: 'product',
      name: 'Aeromish G10S',
      price: 350,
      quantity: 1,
      serialNumbers: ['S000005'],
    },
  ];

  it('allows removal after a partial refund leaves paid amount matching the next total', () => {
    expect(
      canRemoveLineItemAfterPayment(
        items,
        'product-1',
        undefined,
        525,
        { mode: 'amount', value: 100 },
      ),
    ).toBe(true);
  });

  it('blocks removal when the paid amount would exceed the next total', () => {
    expect(
      canRemoveLineItemAfterPayment(
        items,
        'product-1',
        undefined,
        526,
        { mode: 'amount', value: 100 },
      ),
    ).toBe(false);
  });

  it('allows removal for an unpaid order', () => {
    expect(
      canRemoveLineItemAfterPayment(
        items,
        'product-1',
        undefined,
        0,
        { mode: 'amount', value: 100 },
      ),
    ).toBe(true);
  });

  it('does not treat bound serials as a payment blocker', () => {
    expect(
      canRemoveLineItemAfterPayment(
        items,
        'product-3',
        undefined,
        450,
        { mode: 'amount', value: 100 },
      ),
    ).toBe(true);
  });
});

