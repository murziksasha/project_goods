import { describe, expect, it } from 'vitest';
import {
  getProductLineItemGroupKey,
  groupProductLineItems,
} from './order-line-item-groups';

const item = (
  patch: Partial<{
    catalogProductId?: string;
    name: string;
    quantity: number;
    id: string;
  }> = {},
) => ({
  id: 'line-1',
  name: 'iPhone screen',
  quantity: 1,
  ...patch,
});

describe('getProductLineItemGroupKey', () => {
  it('prefers catalogProductId over name', () => {
    expect(
      getProductLineItemGroupKey(
        item({ catalogProductId: 'cat-1', name: 'Screen' }),
      ),
    ).toBe('catalog:cat-1');
  });

  it('falls back to normalized name', () => {
    expect(
      getProductLineItemGroupKey(item({ name: '  iPhone   Screen ' })),
    ).toBe('name:iphone screen');
  });
});

describe('groupProductLineItems', () => {
  it('keeps singles ungrouped in first-seen order', () => {
    const groups = groupProductLineItems([
      item({ id: 'a', name: 'Cable' }),
      item({ id: 'b', name: 'Case' }),
    ]);

    expect(groups).toEqual([
      {
        key: 'name:cable',
        name: 'Cable',
        items: [item({ id: 'a', name: 'Cable' })],
        totalQuantity: 1,
      },
      {
        key: 'name:case',
        name: 'Case',
        items: [item({ id: 'b', name: 'Case' })],
        totalQuantity: 1,
      },
    ]);
  });

  it('groups matching catalog ids and sums quantity', () => {
    const groups = groupProductLineItems([
      item({
        id: 'a',
        catalogProductId: 'cat-1',
        name: 'Screen',
        quantity: 1,
      }),
      item({ id: 'b', name: 'Cable' }),
      item({
        id: 'c',
        catalogProductId: 'cat-1',
        name: 'Screen OEM',
        quantity: 2,
      }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: 'catalog:cat-1',
      name: 'Screen',
      totalQuantity: 3,
    });
    expect(groups[0].items.map((line) => line.id)).toEqual(['a', 'c']);
    expect(groups[1].key).toBe('name:cable');
  });

  it('does not merge the same name when catalog ids differ', () => {
    const groups = groupProductLineItems([
      item({ id: 'a', catalogProductId: 'cat-1', name: 'Screen' }),
      item({ id: 'b', catalogProductId: 'cat-2', name: 'Screen' }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      'catalog:cat-1',
      'catalog:cat-2',
    ]);
  });

  it('groups by name when catalog id is missing', () => {
    const groups = groupProductLineItems([
      item({ id: 'a', name: 'Glass' }),
      item({ id: 'b', name: ' glass ' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].totalQuantity).toBe(2);
    expect(groups[0].items.map((line) => line.id)).toEqual(['a', 'b']);
  });
});
