import { describe, expect, it } from 'vitest';
import { patchLineItemsById } from './line-item-ops';

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

