import { describe, expect, it } from 'vitest';
import {
  getStockDeltas,
  getStockLines,
  isStockCommittedRepairStatus,
  isStockCommittedSaleStatus,
} from './stock';

describe('sale stock helpers', () => {
  it('detects stock-committed statuses', () => {
    expect(isStockCommittedSaleStatus('paid')).toBe(true);
    expect(isStockCommittedSaleStatus('issued')).toBe(true);
    expect(isStockCommittedSaleStatus('draft')).toBe(false);
    expect(isStockCommittedRepairStatus('issuedWithoutRepair')).toBe(true);
    expect(isStockCommittedRepairStatus('diagnostics')).toBe(false);
  });

  it('aggregates product line quantities and falls back when no line products exist', () => {
    expect(
      getStockLines(
        'sale',
        'paid',
        [
          { id: '1', kind: 'product', productId: 'p1', name: 'A', price: 1, quantity: 2 },
          { id: '2', kind: 'product', productId: 'p1', name: 'A', price: 1, quantity: 3 },
          { id: '3', kind: 'service', name: 'S', price: 1, quantity: 1 },
        ],
        1,
        'fallback',
      ),
    ).toEqual([{ productId: 'p1', quantity: 5 }]);

    expect(getStockLines('sale', 'paid', [], 4, 'fallback')).toEqual([
      { productId: 'fallback', quantity: 4 },
    ]);
  });

  it('calculates non-zero deltas between stock line sets', () => {
    expect(
      getStockDeltas(
        [
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 1 },
        ],
        [
          { productId: 'p1', quantity: 5 },
          { productId: 'p3', quantity: 1 },
        ],
      ),
    ).toEqual([
      { productId: 'p1', quantity: 3 },
      { productId: 'p2', quantity: -1 },
      { productId: 'p3', quantity: 1 },
    ]);
  });
});
